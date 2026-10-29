import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  BatchStatus,
  WasteBatchModel,
  ProcessingRecordModel,
  RecoveredMaterialModel,
  RecoveryClaimModel,
  FacilityModel,
  UserModel,
  WasteCategoryModel,
  ReceivingRecordModel,
} from "../models";
import { blockchainService } from "../services/blockchain";
import { validateMassBalance } from "../utils/massBalance";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";
import { sendNotification } from "../services/notification";

const router = Router();

const processingSchema = z.object({
  sourceBatchId: z.string().min(1),
  inputWeightKg: z.number().positive(),
  materials: z
    .array(
      z.object({
        materialType: z.string().min(2),
        weightKg: z.number().positive(),
        purityPercentage: z.number().min(0).max(100).default(99.0),
        location: z.string().default("Facility Smelting Vault"),
      })
    )
    .min(1),
  residualKg: z.number().nonnegative(),
  documentedLossKg: z.number().nonnegative(),
  notes: z.string().optional(),
  evidenceHash: z.string().optional(),
});

const supervisorReviewSchema = z.object({
  approved: z.boolean(),
  remarks: z.string().min(3),
});

// GET /api/processing/available-batches (Batches ready for recycling at worker's facility)
router.get(
  "/available-batches",
  authenticateToken,
  requireRole(Role.WORKER, Role.ADMIN, Role.FACTORY),
  async (req: Request, res: Response) => {
    try {
      const where: any = {
        status: { $in: [BatchStatus.RECEIVED, BatchStatus.DISPUTED] },
      };

      if (req.user!.role === Role.WORKER && req.user!.facilityId) {
        where.destinationFacilityId = req.user!.facilityId;
      }

      const rawBatches = await WasteBatchModel.find(where).sort({ createdAt: -1 }).lean();

      const batches = await Promise.all(
        rawBatches.map(async (b: any) => {
          const idStr = b._id.toString();
          const category = await WasteCategoryModel.findById(b.categoryId).lean();
          const destinationFacility = await FacilityModel.findById(b.destinationFacilityId).lean();
          const receivingRecord = await ReceivingRecordModel.findOne({
            $or: [{ batchId: idStr }, { batchId: b.batchId }],
          }).lean();

          return {
            ...b,
            id: idStr,
            category: category ? { ...category, id: (category as any)._id.toString() } : null,
            destinationFacility: destinationFacility
              ? { ...destinationFacility, id: (destinationFacility as any)._id.toString() }
              : null,
            receivingRecord: receivingRecord
              ? { ...receivingRecord, id: (receivingRecord as any)._id.toString() }
              : null,
          };
        })
      );

      res.json({ success: true, batches });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/processing/records
router.get(
  "/records",
  authenticateToken,
  requireRole(Role.WORKER, Role.ADMIN, Role.FACTORY),
  async (req: Request, res: Response) => {
    try {
      const where: any = {};
      if (req.user!.role === Role.WORKER && req.user!.facilityId) {
        where.facilityId = req.user!.facilityId;
      }

      const rawRecords = await ProcessingRecordModel.find(where).sort({ processedAt: -1 }).lean();

      const records = await Promise.all(
        rawRecords.map(async (p: any) => {
          const idStr = p._id.toString();
          const sourceBatch = (await WasteBatchModel.findOne({
            $or: [{ _id: p.sourceBatchId }, { batchId: p.sourceBatchId }].filter(Boolean),
          }).lean()) as any;

          let populatedBatch = null;
          if (sourceBatch) {
            const cat = await WasteCategoryModel.findById(sourceBatch.categoryId).lean();
            populatedBatch = {
              ...sourceBatch,
              id: sourceBatch._id.toString(),
              category: cat ? { ...cat, id: (cat as any)._id.toString() } : null,
            };
          }

          const workerUser = await UserModel.findById(p.workerUserId).select("fullName").lean();
          const supervisorUser = p.supervisorUserId
            ? await UserModel.findById(p.supervisorUserId).select("fullName").lean()
            : null;
          const facility = await FacilityModel.findById(p.facilityId).lean();

          const materials = await RecoveredMaterialModel.find({
            $or: [{ processingRecordId: idStr }, { processingRecordId: p.processingId }],
          }).lean();

          const populatedMaterials = await Promise.all(
            materials.map(async (m: any) => {
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

          return {
            ...p,
            id: idStr,
            sourceBatch: populatedBatch,
            workerUser,
            supervisorUser,
            facility: facility ? { ...facility, id: (facility as any)._id.toString() } : null,
            recoveredMaterials: populatedMaterials,
          };
        })
      );

      res.json({ success: true, records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/processing (Record recycling & validate mass-balance)
router.post(
  "/",
  authenticateToken,
  requireRole(Role.WORKER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = processingSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const {
        sourceBatchId,
        inputWeightKg,
        materials,
        residualKg,
        documentedLossKg,
        notes,
        evidenceHash,
      } = parse.data;

      // Check source batch
      const queryConditions: any[] = [{ batchId: sourceBatchId }];
      if (mongoose.Types.ObjectId.isValid(sourceBatchId)) {
        queryConditions.push({ _id: sourceBatchId });
      }

      const batch = await WasteBatchModel.findOne({ $or: queryConditions });

      if (!batch) {
        res.status(404).json({ success: false, error: "Source batch not found" });
        return;
      }

      if (batch.status === BatchStatus.PROCESSED) {
        res.status(400).json({ success: false, error: "This batch has already been processed." });
        return;
      }

      // STRICT MASS BALANCE CALCULATION & VALIDATION
      const recoveredWeights = materials.map((m) => m.weightKg);
      const massBalance = validateMassBalance({
        inputWeightKg,
        recoveredWeightsKg: recoveredWeights,
        residualWasteKg: residualKg,
        documentedLossKg,
      });

      if (!massBalance.isValid) {
        res.status(422).json({
          success: false,
          error: "Mass-balance validation failed! The quantities do not balance.",
          massBalance,
        });
        return;
      }

      const count = await ProcessingRecordModel.countDocuments();
      const processingId = `PROC-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const computedHash = evidenceHash || computeSha256(processingId + batch.batchId + inputWeightKg);

      // On-chain registration via EWasteRegistry.sol
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.recordProcessing(
          processingId,
          batch.batchId,
          inputWeightKg,
          massBalance.totalRecoveredKg,
          residualKg,
          documentedLossKg,
          computedHash
        );
      } catch (bcErr: any) {
        console.warn("Blockchain processing notice:", bcErr.message);
      }

      const facilityId = req.user!.facilityId || batch.destinationFacilityId;

      const record = await ProcessingRecordModel.create({
        processingId,
        sourceBatchId: batch._id.toString(),
        facilityId,
        workerUserId: req.user!.id,
        inputWeightKg,
        totalRecoveredKg: massBalance.totalRecoveredKg,
        residualKg,
        documentedLossKg,
        massBalanceValid: true,
        supervisorApproved: req.user!.role === Role.ADMIN,
        notes,
        evidenceHash: computedHash,
        txHash,
      });

      // Register each recovered material batch
      let matIndex = 1;
      for (const mat of materials) {
        const matBatchId = `MAT-${mat.materialType.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}-${String(Date.now()).slice(-4)}${matIndex++}`;
        const matHash = computeSha256(matBatchId + mat.weightKg);

        let matTxHash: string | null = null;
        try {
          matTxHash = await blockchainService.registerRecoveredMaterial(
            matBatchId,
            batch.batchId,
            mat.materialType,
            mat.weightKg,
            matHash
          );
        } catch (e: any) {
          console.warn("Recovered material blockchain notice:", e.message);
        }

        await RecoveredMaterialModel.create({
          materialBatchId: matBatchId,
          sourceBatchId: batch._id.toString(),
          processingRecordId: record._id.toString(),
          materialType: mat.materialType,
          recoveredWeightKg: mat.weightKg,
          claimedWeightKg: 0,
          purityPercentage: mat.purityPercentage,
          location: mat.location,
          evidenceHash: matHash,
          txHash: matTxHash,
        });
      }

      // Update batch status to PROCESSED
      await WasteBatchModel.findByIdAndUpdate(batch._id, { status: BatchStatus.PROCESSED });

      await logAudit({
        userId: req.user!.id,
        action: "PROCESSING_RECORDED_MASS_BALANCE_VERIFIED",
        entityType: "PROCESSING",
        entityId: record.processingId,
        details: {
          inputWeightKg,
          totalRecoveredKg: massBalance.totalRecoveredKg,
          recoveryYieldPercentage: massBalance.recoveryYieldPercentage,
          txHash,
        },
        ipAddress: req.ip,
      });

      await sendNotification({
        role: Role.ADMIN,
        title: "Recycling Mass-Balance Verified",
        message: `Operation ${record.processingId} completed: ${record.inputWeightKg} kg processed, ${record.totalRecoveredKg} kg recovered (${massBalance.recoveryYieldPercentage}% yield).`,
        type: "SUCCESS",
        entityType: "PROCESSING",
        entityId: record.processingId,
      });

      res.status(201).json({
        success: true,
        processingRecord: record,
        massBalance,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /api/processing/:id/supervisor-review
router.patch(
  "/:id/supervisor-review",
  authenticateToken,
  requireRole(Role.ADMIN, Role.FACTORY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parse = supervisorReviewSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const { approved, remarks } = parse.data;

      const queryConditions: any[] = [{ processingId: id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryConditions.push({ _id: id });
      }

      const record = await ProcessingRecordModel.findOneAndUpdate(
        { $or: queryConditions },
        {
          supervisorApproved: approved,
          supervisorRemarks: remarks,
          supervisorUserId: req.user!.id,
        },
        { new: true }
      );

      if (!record) {
        res.status(404).json({ success: false, error: "Processing record not found" });
        return;
      }

      await logAudit({
        userId: req.user!.id,
        action: approved ? "SUPERVISOR_APPROVAL" : "SUPERVISOR_REJECTION",
        entityType: "PROCESSING",
        entityId: record.processingId,
        details: { approved, remarks },
        ipAddress: req.ip,
      });

      res.json({ success: true, processingRecord: record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
