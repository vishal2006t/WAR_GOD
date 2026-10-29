import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  ProductModel,
  ProductServiceRecordModel,
  OwnershipEventModel,
  WasteBatchModel,
  WasteCategoryModel,
  FacilityModel,
  RecoveredMaterialModel,
  RecoveryClaimModel,
} from "../models";
import { blockchainService } from "../services/blockchain";
import { generateQrCodeDataUrl } from "../utils/qr";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";
import rateLimit from "express-rate-limit";

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many verification requests, please try again shortly." },
});

const createProductSchema = z.object({
  name: z.string().min(2),
  brandModel: z.string().optional(),
  serialNumber: z.string().optional(),
  sourceBatchId: z.string().min(1).optional(),
  condition: z.string().min(2),
  replacedComponents: z.string().optional(),
  technicianName: z.string().min(2),
  warrantyMonths: z.number().int().nonnegative().default(6),
  inspectionReportHash: z.string().optional(),
});

const serviceRecordSchema = z.object({
  serviceType: z.string().min(2),
  description: z.string().min(5),
  technicianName: z.string().min(2),
});

// GET /api/products/verify/:query (PUBLIC ENDPOINT - Product ID, Serial Number, Batch ID, Material ID, or Claim Ref)
router.get("/verify/:query", verifyLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.params;
    const cleanQuery = decodeURIComponent(query).trim();

    const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escapedQuery}$`, "i");

    // 1. Check ProductModel
    const product = (await ProductModel.findOne({
      $or: [{ productId: regex }, { serialNumber: regex }],
    }).lean()) as any;

    if (!product) {
      // 2. Check WasteBatchModel
      const batchQuery: any[] = [{ batchId: regex }, { traceabilityRef: regex }];
      if (mongoose.Types.ObjectId.isValid(cleanQuery)) {
        batchQuery.push({ _id: cleanQuery });
      }
      const batch = (await WasteBatchModel.findOne({ $or: batchQuery }).lean()) as any;

      if (batch) {
        const cat = batch.categoryId ? await WasteCategoryModel.findById(batch.categoryId).lean() : null;
        const fac = batch.destinationFacilityId ? await FacilityModel.findById(batch.destinationFacilityId).lean() : null;

        res.json({
          success: true,
          status: "VERIFIED",
          entityType: "WASTE_BATCH",
          record: {
            batchId: batch.batchId,
            traceabilityRef: batch.traceabilityRef || batch.batchId,
            category: cat ? cat.name : "E-Waste",
            status: batch.status,
            initialWeightKg: batch.initialWeightKg,
            sourceLocation: batch.pickupAddress || batch.source || "Origin Collector Site",
            facility: fac ? fac.name : "Central E-Waste Hub",
            collectionDate: batch.collectionDate || batch.createdAt,
            txHash: batch.txHash || null,
            blockchainProof: {
              verifiedOnChain: !!batch.txHash,
              txHash: batch.txHash || null,
              network: "Hardhat Local EVM (31337)",
            },
          },
        });
        return;
      }

      // 3. Check RecoveryClaimModel
      const claimQuery: any[] = [{ claimReference: regex }];
      if (mongoose.Types.ObjectId.isValid(cleanQuery)) {
        claimQuery.push({ _id: cleanQuery });
      }
      const claim = (await RecoveryClaimModel.findOne({ $or: claimQuery }).lean()) as any;

      if (claim) {
        res.json({
          success: true,
          status: "VERIFIED",
          entityType: "RECOVERY_CLAIM",
          record: {
            claimReference: claim.claimReference,
            materialType: claim.materialType,
            claimedWeightKg: claim.claimedWeightKg,
            status: claim.status,
            beneficiary: claim.productName || claim.beneficiary || "Refurbished Production Line",
            decisionReason: claim.decisionReason,
            createdAt: claim.createdAt,
            txHash: claim.txHash || null,
            blockchainProof: {
              verifiedOnChain: !!claim.txHash,
              txHash: claim.txHash || null,
              network: "Hardhat Local EVM (31337)",
            },
          },
        });
        return;
      }

      // 4. Check RecoveredMaterialModel
      const matQuery: any[] = [{ sourceBatchId: regex }, { processingBatchId: regex }];
      if (mongoose.Types.ObjectId.isValid(cleanQuery)) {
        matQuery.push({ _id: cleanQuery });
      }
      const mat = (await RecoveredMaterialModel.findOne({ $or: matQuery }).lean()) as any;

      if (mat) {
        res.json({
          success: true,
          status: "VERIFIED",
          entityType: "RECOVERED_MATERIAL",
          record: {
            materialId: mat._id.toString(),
            materialType: mat.materialType,
            purityPercentage: mat.purityPercentage || 95,
            recoveredWeightKg: mat.recoveredWeightKg,
            claimedWeightKg: mat.claimedWeightKg || 0,
            availableWeightKg: Math.max(0, (mat.recoveredWeightKg || 0) - (mat.claimedWeightKg || 0)),
            storageLocation: mat.storageLocation || "Warehouse Vault",
            createdAt: mat.createdAt,
            txHash: mat.txHash || null,
            blockchainProof: {
              verifiedOnChain: !!mat.txHash,
              txHash: mat.txHash || null,
              network: "Hardhat Local EVM (31337)",
            },
          },
        });
        return;
      }

      res.status(404).json({
        success: false,
        status: "NOT_FOUND",
        error: `No certified record found matching reference '${cleanQuery}'. Verified items must have a valid registered product, batch, material, or claim reference.`,
      });
      return;
    }

    const idStr = product._id.toString();

    // Populate source batch
    let sourceOrigin = null;
    if (product.sourceBatchId) {
      const sourceBatch = (await WasteBatchModel.findOne({
        $or: [{ _id: product.sourceBatchId }, { batchId: product.sourceBatchId }].filter(Boolean),
      }).lean()) as any;

      if (sourceBatch) {
        const cat = await WasteCategoryModel.findById(sourceBatch.categoryId).lean();
        const facility = await FacilityModel.findById(sourceBatch.destinationFacilityId).lean();
        sourceOrigin = {
          batchId: sourceBatch.batchId,
          category: cat ? cat.name : "N/A",
          processingHub: facility ? facility.name : "N/A",
        };
      }
    }

    // Populate service records and ownership events
    const [serviceRecords, ownershipEvents] = await Promise.all([
      ProductServiceRecordModel.find({
        $or: [{ productId: idStr }, { productId: product.productId }],
      })
        .sort({ serviceDate: -1 })
        .lean(),
      OwnershipEventModel.find({
        $or: [{ productId: idStr }, { productId: product.productId }],
      })
        .sort({ timestamp: -1 })
        .lean(),
    ]);

    // Attempt on-chain verification check
    let onChainProof: any = null;
    try {
      onChainProof = await blockchainService.verifyProduct(product.productId);
    } catch (e: any) {
      console.warn("On-chain verification lookup:", e.message);
    }

    res.json({
      success: true,
      status: "VERIFIED",
      product: {
        productId: product.productId,
        serialNumber: product.serialNumber,
        name: product.name,
        brandModel: product.brandModel,
        condition: product.condition,
        refurbishmentDate: product.refurbishmentDate || product.createdAt,
        replacedComponents: product.replacedComponents,
        warrantyMonths: product.warrantyMonths,
        technicianApproved: product.technicianApproved,
        technicianName: product.technicianName,
        inspectionReportHash: product.inspectionReportHash,
        qrCodeData: product.qrCodeData,
        txHash: product.txHash,
        sourceOrigin,
        serviceHistory: serviceRecords.map((s: any) => ({
          serviceDate: s.serviceDate,
          serviceType: s.serviceType,
          description: s.description,
          technicianName: s.technicianName,
        })),
        lifecycleEvents: ownershipEvents.map((o: any) => ({
          eventType: o.eventType,
          description: o.description,
          timestamp: o.timestamp,
        })),
        blockchainProof: {
          verifiedOnChain: !!product.txHash,
          txHash: product.txHash,
          onChainData: onChainProof,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products (List products for authenticated users)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const rawProducts = await ProductModel.find({}).sort({ createdAt: -1 }).lean();

    const products = await Promise.all(
      rawProducts.map(async (p: any) => {
        const idStr = p._id.toString();
        let sourceBatch = null;
        if (p.sourceBatchId) {
          const b = (await WasteBatchModel.findOne({
            $or: [{ _id: p.sourceBatchId }, { batchId: p.sourceBatchId }].filter(Boolean),
          }).lean()) as any;

          if (b) {
            const cat = await WasteCategoryModel.findById(b.categoryId).lean();
            sourceBatch = {
              ...b,
              id: b._id.toString(),
              category: cat ? { ...cat, id: (cat as any)._id.toString() } : null,
            };
          }
        }

        const serviceRecords = await ProductServiceRecordModel.find({
          $or: [{ productId: idStr }, { productId: p.productId }],
        }).lean();

        return {
          ...p,
          id: idStr,
          sourceBatch,
          serviceRecords: serviceRecords.map((s: any) => ({ ...s, id: s._id.toString() })),
        };
      })
    );

    res.json({ success: true, products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products (Register refurbished product)
router.post(
  "/",
  authenticateToken,
  requireRole(Role.WORKER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = createProductSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const {
        name,
        brandModel,
        serialNumber,
        sourceBatchId,
        condition,
        replacedComponents,
        technicianName,
        warrantyMonths,
        inspectionReportHash,
      } = parse.data;

      // Unique serial check if provided
      if (serialNumber) {
        const existingSerial = await ProductModel.findOne({ serialNumber });
        if (existingSerial) {
          res.status(409).json({
            success: false,
            error: `Product with serial number '${serialNumber}' already registered.`,
          });
          return;
        }
      }

      const count = await ProductModel.countDocuments();
      const productId = `PROD-REFURB-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const computedHash =
        inspectionReportHash || computeSha256(productId + (serialNumber || "") + condition);

      // Generate verification QR code
      const qrCodeData = await generateQrCodeDataUrl({
        productId,
        serialNumber: serialNumber || "N/A",
        name,
        condition,
        verified: true,
      });

      // Submit on-chain via EWasteRegistry.sol
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.registerRefurbishedProduct(
          productId,
          serialNumber || "",
          sourceBatchId || "",
          condition,
          computedHash
        );
      } catch (bcErr: any) {
        console.warn("Blockchain product notice:", bcErr.message);
      }

      const product = await ProductModel.create({
        productId,
        serialNumber,
        name,
        brandModel,
        sourceBatchId,
        condition,
        replacedComponents,
        inspectionReportHash: computedHash,
        technicianApproved: true,
        technicianName,
        warrantyMonths,
        qrCodeData,
        txHash,
      });

      await OwnershipEventModel.create({
        productId: product._id.toString(),
        eventType: "REGISTERED",
        description: "Certified refurbished product registered for circular lifecycle distribution.",
      });

      await logAudit({
        userId: req.user!.id,
        action: "PRODUCT_REFURBISHED_REGISTERED",
        entityType: "PRODUCT",
        entityId: product.productId,
        details: { serialNumber, condition, txHash },
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/products/:id/service (Add service record)
router.post(
  "/:id/service",
  authenticateToken,
  requireRole(Role.WORKER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parse = serviceRecordSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const { serviceType, description, technicianName } = parse.data;

      const record = await ProductServiceRecordModel.create({
        productId: id,
        serviceType,
        description,
        technicianName,
      });

      res.status(201).json({ success: true, serviceRecord: record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
