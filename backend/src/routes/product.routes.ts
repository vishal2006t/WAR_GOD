import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";
import { blockchainService } from "../services/blockchain";
import { generateQrCodeDataUrl } from "../utils/qr";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";

const router = Router();

const createProductSchema = z.object({
  name: z.string().min(2),
  brandModel: z.string().optional(),
  serialNumber: z.string().optional(),
  sourceBatchId: z.string().uuid().optional(),
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

// GET /api/products/verify/:query (PUBLIC ENDPOINT - Product ID, Serial Number or QR payload)
router.get("/verify/:query", async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.params;
    const cleanQuery = decodeURIComponent(query).trim();

    // Look up by productId OR serialNumber
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { productId: { equals: cleanQuery, mode: "insensitive" } },
          { serialNumber: { equals: cleanQuery, mode: "insensitive" } },
        ],
      },
      include: {
        sourceBatch: {
          select: {
            batchId: true,
            category: { select: { name: true, code: true } },
            destinationFacility: { select: { name: true, facilityType: true } },
          },
        },
        serviceRecords: {
          orderBy: { serviceDate: "desc" },
          select: {
            serviceDate: true,
            serviceType: true,
            description: true,
            technicianName: true,
          },
        },
        ownershipEvents: {
          orderBy: { timestamp: "desc" },
          select: {
            eventType: true,
            description: true,
            timestamp: true,
          },
        },
      },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        status: "NOT_FOUND",
        error: `No certified product found matching query '${cleanQuery}'.`,
      });
      return;
    }

    // Attempt on-chain verification check
    let onChainProof: any = null;
    try {
      onChainProof = await blockchainService.verifyProduct(product.productId);
    } catch (e: any) {
      console.warn("On-chain verification lookup:", e.message);
    }

    // Public response: strictly excludes personal private owner identities or private invoices
    res.json({
      success: true,
      status: "VERIFIED",
      product: {
        productId: product.productId,
        serialNumber: product.serialNumber,
        name: product.name,
        brandModel: product.brandModel,
        condition: product.condition,
        refurbishmentDate: product.refurbishmentDate,
        replacedComponents: product.replacedComponents,
        warrantyMonths: product.warrantyMonths,
        technicianApproved: product.technicianApproved,
        technicianName: product.technicianName,
        inspectionReportHash: product.inspectionReportHash,
        qrCodeData: product.qrCodeData,
        txHash: product.txHash,
        sourceOrigin: product.sourceBatch ? {
          batchId: product.sourceBatch.batchId,
          category: product.sourceBatch.category.name,
          processingHub: product.sourceBatch.destinationFacility.name,
        } : null,
        serviceHistory: product.serviceRecords,
        lifecycleEvents: product.ownershipEvents,
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
    const products = await prisma.product.findMany({
      include: {
        sourceBatch: { include: { category: true } },
        serviceRecords: true,
      },
      orderBy: { createdAt: "desc" },
    });

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
        const existingSerial = await prisma.product.findUnique({ where: { serialNumber } });
        if (existingSerial) {
          res.status(409).json({ success: false, error: `Product with serial number '${serialNumber}' already registered.` });
          return;
        }
      }

      const count = await prisma.product.count();
      const productId = `PROD-REFURB-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const computedHash = inspectionReportHash || computeSha256(productId + (serialNumber || "") + condition);

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

      const product = await prisma.product.create({
        data: {
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
        },
      });

      await prisma.ownershipEvent.create({
        data: {
          productId: product.id,
          eventType: "REGISTERED",
          description: "Certified refurbished product registered for circular lifecycle distribution.",
        },
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

      const record = await prisma.productServiceRecord.create({
        data: {
          productId: id,
          serviceType,
          description,
          technicianName,
        },
      });

      res.status(201).json({ success: true, serviceRecord: record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
