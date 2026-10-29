import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  BatchStatus,
  WasteCategoryModel,
  FacilityModel,
  WasteBatchModel,
  UserModel,
  ReceivingRecordModel,
  ProcessingRecordModel,
  RecoveredMaterialModel,
  RecoveryClaimModel,
  ProductModel,
  DispatchModel,
  HandoverModel,
} from "../models";
import { blockchainService } from "../services/blockchain";
import { generateQrCodeDataUrl } from "../utils/qr";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";
import { sendNotification } from "../services/notification";

const router = Router();

const createBatchSchema = z.object({
  categoryId: z.string().min(1),
  destinationFacilityId: z.string().min(1),
  pickupLocation: z.string().min(3),
  pickupAddress: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  collectionDate: z.string().optional(),
  sourceType: z.string().min(2),
  description: z.string().min(3),
  initialWeightKg: z.number().positive(),
  evidenceHash: z.string().optional(),
  weighingSlipUrl: z.string().optional(),
});

const updateBatchSchema = z.object({
  categoryId: z.string().optional(),
  destinationFacilityId: z.string().optional(),
  pickupLocation: z.string().optional(),
  pickupAddress: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  collectionDate: z.string().optional(),
  sourceType: z.string().optional(),
  description: z.string().optional(),
  initialWeightKg: z.number().positive().optional(),
});

// GET /api/batches/categories
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await WasteCategoryModel.find({}).sort({ name: 1 }).lean();
    const formatted = categories.map((c: any) => ({ ...c, id: c._id.toString() }));
    res.json({ success: true, categories: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/batches/facilities
router.get("/facilities", async (req: Request, res: Response) => {
  try {
    const facilities = await FacilityModel.find({ authorized: true }).sort({ name: 1 }).lean();
    const formatted = facilities.map((f: any) => ({ ...f, id: f._id.toString() }));
    res.json({ success: true, facilities: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/batches (Dealer collection registration)
router.post(
  "/",
  authenticateToken,
  requireRole(Role.DEALER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = createBatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const {
        categoryId,
        destinationFacilityId,
        pickupLocation,
        pickupAddress,
        contactPhone,
        contactEmail,
        collectionDate,
        sourceType,
        description,
        initialWeightKg,
        evidenceHash,
        weighingSlipUrl,
      } = parse.data;

      // Verify category and facility
      const category =
        (mongoose.Types.ObjectId.isValid(categoryId)
          ? await WasteCategoryModel.findById(categoryId)
          : null) || (await WasteCategoryModel.findOne({ $or: [{ code: categoryId }, { name: categoryId }] }));

      if (!category) {
        res.status(404).json({ success: false, error: "Waste category not found" });
        return;
      }

      const facility =
        (mongoose.Types.ObjectId.isValid(destinationFacilityId)
          ? await FacilityModel.findById(destinationFacilityId)
          : null) || (await FacilityModel.findOne({ $or: [{ code: destinationFacilityId }, { name: destinationFacilityId }] }));

      if (!facility || !facility.authorized) {
        res.status(400).json({ success: false, error: "Selected receiving facility is not authorized" });
        return;
      }

      // Generate unique human-readable Batch ID
      const count = await WasteBatchModel.countDocuments();
      const batchId = `BATCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const computedHash = evidenceHash || computeSha256(batchId + (pickupAddress || pickupLocation) + initialWeightKg);

      // Generate QR Code data URL
      const qrCodeData = await generateQrCodeDataUrl({
        batchId,
        weightKg: initialWeightKg,
        category: category.name,
        facility: facility.name,
        timestamp: new Date().toISOString(),
      });

      // Submit to Blockchain (EWasteRegistry.sol)
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.recordBatch(
          batchId,
          category.name,
          initialWeightKg,
          computedHash,
          facility.code
        );
      } catch (bcErr: any) {
        console.warn("Blockchain registration notice:", bcErr.message);
      }

      const batch = await WasteBatchModel.create({
        batchId,
        dealerId: req.user!.id,
        categoryId: category._id.toString(),
        destinationFacilityId: facility._id.toString(),
        pickupLocation,
        pickupAddress: pickupAddress || pickupLocation,
        contactPhone,
        contactEmail,
        collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
        sourceType,
        description,
        initialWeightKg,
        status: BatchStatus.REGISTERED,
        evidenceHash: computedHash,
        weighingSlipUrl,
        qrCodeData,
        txHash,
      });

      await logAudit({
        userId: req.user!.id,
        action: "BATCH_REGISTERED",
        entityType: "BATCH",
        entityId: batch.batchId,
        details: { initialWeightKg, destinationFacility: facility.name, txHash },
        ipAddress: req.ip,
      });

      await sendNotification({
        role: Role.ADMIN,
        title: "New E-Waste Batch Registered",
        message: `Batch ${batch.batchId} (${initialWeightKg} kg) registered by ${req.user!.fullName}.`,
        type: "INFO",
        entityType: "BATCH",
        entityId: batch.batchId,
      });

      const fullBatch = {
        ...batch.toJSON(),
        category: { ...category.toJSON(), id: category._id.toString() },
        destinationFacility: { ...facility.toJSON(), id: facility._id.toString() },
        dealer: { fullName: req.user!.fullName, organization: req.user!.organization },
      };

      res.status(201).json({ success: true, batch: fullBatch });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/batches (List batches with role, search, and status filtering)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, categoryId, facilityId, search } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = String(categoryId);
    if (facilityId) where.destinationFacilityId = String(facilityId);

    if (search) {
      const searchRegex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      where.$or = [
        { batchId: searchRegex },
        { pickupLocation: searchRegex },
        { pickupAddress: searchRegex },
        { description: searchRegex },
        { sourceType: searchRegex },
      ];
    }

    // If dealer, show their batches unless admin
    if (req.user!.role === Role.DEALER) {
      where.dealerId = req.user!.id;
    } else if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
      where.destinationFacilityId = req.user!.facilityId;
    }

    const rawBatches = await WasteBatchModel.find(where).sort({ createdAt: -1 }).lean();

    const batches = await Promise.all(
      rawBatches.map(async (b: any) => {
        const idStr = b._id.toString();
        const category = await WasteCategoryModel.findById(b.categoryId).lean();
        const destinationFacility = await FacilityModel.findById(b.destinationFacilityId).lean();
        const dealer = await UserModel.findById(b.dealerId).select("fullName organization email").lean();
        const receivingRecord = await ReceivingRecordModel.findOne({
          $or: [{ batchId: idStr }, { batchId: b.batchId }],
        }).lean();
        const processingRecords = await ProcessingRecordModel.find({
          $or: [{ sourceBatchId: idStr }, { sourceBatchId: b.batchId }],
        }).lean();

        return {
          ...b,
          id: idStr,
          category: category ? { ...category, id: (category as any)._id.toString() } : null,
          destinationFacility: destinationFacility
            ? { ...destinationFacility, id: (destinationFacility as any)._id.toString() }
            : null,
          dealer,
          receivingRecord: receivingRecord ? { ...receivingRecord, id: (receivingRecord as any)._id.toString() } : null,
          processingRecords: processingRecords.map((p: any) => ({ ...p, id: p._id.toString() })),
        };
      })
    );

    res.json({ success: true, batches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/batches/:id (Edit batch before dispatch)
router.put("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parse = updateBatchSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
      return;
    }

    const query: any[] = [{ batchId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) query.push({ _id: id });
    const batch = await WasteBatchModel.findOne({ $or: query });

    if (!batch) {
      res.status(404).json({ success: false, error: "Batch not found" });
      return;
    }

    // Role check: Only the creating dealer or an admin can edit
    if (req.user!.role !== Role.ADMIN && batch.dealerId !== req.user!.id) {
      res.status(403).json({ success: false, error: "Unauthorized: You can only edit your own collection batches." });
      return;
    }

    // Status check: Only REGISTERED batches can be edited before dispatch
    if (batch.status !== BatchStatus.REGISTERED) {
      res.status(400).json({
        success: false,
        error: `Cannot edit batch in '${batch.status}' status. Only REGISTERED batches can be edited prior to dispatch.`,
      });
      return;
    }

    const data = parse.data;
    if (data.categoryId) batch.categoryId = data.categoryId;
    if (data.destinationFacilityId) batch.destinationFacilityId = data.destinationFacilityId;
    if (data.pickupLocation) batch.pickupLocation = data.pickupLocation;
    if (data.pickupAddress) batch.pickupAddress = data.pickupAddress;
    if (data.contactPhone !== undefined) batch.contactPhone = data.contactPhone;
    if (data.contactEmail !== undefined) batch.contactEmail = data.contactEmail;
    if (data.collectionDate) batch.collectionDate = new Date(data.collectionDate);
    if (data.sourceType) batch.sourceType = data.sourceType;
    if (data.description) batch.description = data.description;
    if (data.initialWeightKg !== undefined) batch.initialWeightKg = data.initialWeightKg;

    // Recompute hash & QR code
    const computedHash = computeSha256(batch.batchId + (batch.pickupAddress || batch.pickupLocation) + batch.initialWeightKg);
    batch.evidenceHash = computedHash;

    const qrCodeData = await generateQrCodeDataUrl({
      batchId: batch.batchId,
      weightKg: batch.initialWeightKg,
      category: batch.categoryId,
      facility: batch.destinationFacilityId,
      timestamp: new Date().toISOString(),
    });
    batch.qrCodeData = qrCodeData;

    await batch.save();

    await logAudit({
      userId: req.user!.id,
      action: "BATCH_UPDATED",
      entityType: "BATCH",
      entityId: batch.batchId,
      details: { updatedFields: Object.keys(data), newWeightKg: batch.initialWeightKg },
      ipAddress: req.ip,
    });

    res.json({ success: true, batch });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/batches/:batchId (Detail & Full Provenance)
router.get("/:batchId", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const queryConditions: any[] = [{ batchId }];
    if (mongoose.Types.ObjectId.isValid(batchId)) {
      queryConditions.push({ _id: batchId });
    }

    const batch = await WasteBatchModel.findOne({ $or: queryConditions }).lean();

    if (!batch) {
      res.status(404).json({ success: false, error: "Batch not found" });
      return;
    }

    const bId = (batch as any)._id.toString();
    const [
      category,
      destinationFacility,
      dealer,
      dispatches,
      receivingRecord,
      processingRecords,
      recoveredMaterials,
      refurbishedProducts,
    ] = await Promise.all([
      WasteCategoryModel.findById(batch.categoryId).lean(),
      FacilityModel.findById(batch.destinationFacilityId).lean(),
      UserModel.findById(batch.dealerId).select("id fullName organization email").lean(),
      DispatchModel.find({ batchIds: { $in: [bId, batch.batchId] } }).lean(),
      ReceivingRecordModel.findOne({ $or: [{ batchId: bId }, { batchId: batch.batchId }] }).lean(),
      ProcessingRecordModel.find({ $or: [{ sourceBatchId: bId }, { sourceBatchId: batch.batchId }] }).lean(),
      RecoveredMaterialModel.find({ $or: [{ sourceBatchId: bId }, { sourceBatchId: batch.batchId }] }).lean(),
      ProductModel.find({ $or: [{ sourceBatchId: bId }, { sourceBatchId: batch.batchId }] }).lean(),
    ]);

    // Populate nested dispatch data
    const populatedDispatches = await Promise.all(
      dispatches.map(async (d: any) => {
        const driver = d.driverId
          ? await UserModel.findById(d.driverId).select("fullName phone").lean()
          : null;
        const handovers = await HandoverModel.find({ dispatchId: d._id.toString() }).lean();
        return {
          dispatch: {
            ...d,
            id: d._id.toString(),
            driver,
            handovers: handovers.map((h: any) => ({ ...h, id: h._id.toString() })),
          },
        };
      })
    );

    // Populate receiving record user
    let populatedReceiving = null;
    if (receivingRecord) {
      const receiverUser = await UserModel.findById((receivingRecord as any).receiverUserId).select("fullName").lean();
      const facility = await FacilityModel.findById((receivingRecord as any).facilityId).lean();
      populatedReceiving = {
        ...receivingRecord,
        id: (receivingRecord as any)._id.toString(),
        receiverUser,
        facility: facility ? { ...facility, id: (facility as any)._id.toString() } : null,
      };
    }

    // Populate processing records
    const populatedProcessing = await Promise.all(
      processingRecords.map(async (p: any) => {
        const workerUser = await UserModel.findById(p.workerUserId).select("fullName").lean();
        const supervisorUser = p.supervisorUserId
          ? await UserModel.findById(p.supervisorUserId).select("fullName").lean()
          : null;
        const mats = await RecoveredMaterialModel.find({ processingRecordId: p._id.toString() }).lean();
        return {
          ...p,
          id: p._id.toString(),
          workerUser,
          supervisorUser,
          recoveredMaterials: mats.map((m: any) => ({ ...m, id: m._id.toString() })),
        };
      })
    );

    // Populate recovered materials and their claims
    const populatedMaterials = await Promise.all(
      recoveredMaterials.map(async (m: any) => {
        const claims = await RecoveryClaimModel.find({
          $or: [{ materialBatchId: m._id.toString() }, { materialBatchId: m.materialBatchId }],
        }).lean();
        return {
          ...m,
          id: m._id.toString(),
          claims: claims.map((c: any) => ({ ...c, id: c._id.toString() })),
        };
      })
    );

    const fullBatch = {
      ...batch,
      id: bId,
      category: category ? { ...category, id: (category as any)._id.toString() } : null,
      destinationFacility: destinationFacility
        ? { ...destinationFacility, id: (destinationFacility as any)._id.toString() }
        : null,
      dealer: dealer ? { ...dealer, id: (dealer as any)._id.toString() } : null,
      dispatches: populatedDispatches,
      receivingRecord: populatedReceiving,
      processingRecords: populatedProcessing,
      recoveredMaterials: populatedMaterials,
      refurbishedProducts: refurbishedProducts.map((p: any) => ({ ...p, id: p._id.toString() })),
    };

    res.json({ success: true, batch: fullBatch });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
