import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  RecoveredMaterialModel,
  RecoveryClaimModel,
  WasteBatchModel,
  WasteCategoryModel,
  FacilityModel,
  ProcessingRecordModel,
  UserModel,
} from "../models";
import { blockchainService } from "../services/blockchain";
import { logAudit } from "../services/audit";
import { sendNotification } from "../services/notification";

const router = Router();

const claimSchema = z.object({
  materialBatchId: z.string().min(1),
  claimedWeightKg: z.number().positive(),
  claimantName: z.string().min(2),
  claimantOrg: z.string().min(2),
  notes: z.string().optional(),
});

// GET /api/materials (List recovered materials)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const rawMaterials = await RecoveredMaterialModel.find({}).sort({ createdAt: -1 }).lean();

    const materials = await Promise.all(
      rawMaterials.map(async (m: any) => {
        const idStr = m._id.toString();
        const isBatchMongoId = typeof m.sourceBatchId === "string" && /^[0-9a-fA-F]{24}$/.test(m.sourceBatchId);
        const sourceBatch = (await WasteBatchModel.findOne(
          isBatchMongoId ? { $or: [{ _id: m.sourceBatchId }, { batchId: m.sourceBatchId }] } : { batchId: m.sourceBatchId }
        ).lean()) as any;

        let populatedBatch = null;
        if (sourceBatch) {
          const category = await WasteCategoryModel.findById(sourceBatch.categoryId).lean();
          const destinationFacility = await FacilityModel.findById(sourceBatch.destinationFacilityId).lean();
          populatedBatch = {
            ...sourceBatch,
            id: sourceBatch._id.toString(),
            category: category ? { ...category, id: (category as any)._id.toString() } : null,
            destinationFacility: destinationFacility
              ? { ...destinationFacility, id: (destinationFacility as any)._id.toString() }
              : null,
          };
        }

        const isProcMongoId = typeof m.processingRecordId === "string" && /^[0-9a-fA-F]{24}$/.test(m.processingRecordId);
        const processingRecord = (await ProcessingRecordModel.findOne(
          isProcMongoId ? { $or: [{ _id: m.processingRecordId }, { processingId: m.processingRecordId }] } : { processingId: m.processingRecordId }
        ).lean()) as any;

        let populatedProc = null;
        if (processingRecord) {
          const workerUser = await UserModel.findById(processingRecord.workerUserId).select("fullName").lean();
          populatedProc = {
            ...processingRecord,
            id: processingRecord._id.toString(),
            workerUser,
          };
        }

        const claims = await RecoveryClaimModel.find({
          $or: [{ materialBatchId: idStr }, { materialBatchId: m.materialBatchId }],
        }).lean();

        return {
          ...m,
          id: idStr,
          sourceBatch: populatedBatch,
          processingRecord: populatedProc,
          claims: claims.map((c: any) => ({ ...c, id: c._id.toString() })),
        };
      })
    );

    res.json({ success: true, materials });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/materials/claim (Submit material claim with strict duplicate & over-claim checks)
router.post(
  "/claim",
  authenticateToken,
  requireRole(Role.ADMIN, Role.CUSTOMER, Role.WORKER, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = claimSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const { materialBatchId, claimedWeightKg, claimantName, claimantOrg, notes } = parse.data;

      const queryConditions: any[] = [{ materialBatchId }];
      if (mongoose.Types.ObjectId.isValid(materialBatchId)) {
        queryConditions.push({ _id: materialBatchId });
      }

      const material = await RecoveredMaterialModel.findOne({ $or: queryConditions });

      if (!material) {
        res.status(404).json({ success: false, error: "Recovered material batch not found" });
        return;
      }

      const availableKg = Number((material.recoveredWeightKg - material.claimedWeightKg).toFixed(3));

      // DUPLICATE / OVER-CLAIM PREVENTION
      if (claimedWeightKg > availableKg) {
        await logAudit({
          userId: req.user!.id,
          action: "EXCESSIVE_CLAIM_REJECTED",
          entityType: "RECOVERED_MATERIAL",
          entityId: material.materialBatchId,
          details: {
            requestedKg: claimedWeightKg,
            availableKg,
            claimantOrg,
            reason: "Claim exceeds remaining unallocated certified material weight.",
          },
          ipAddress: req.ip,
        });

        await sendNotification({
          role: Role.ADMIN,
          title: "Excessive / Over-Claim Blocked",
          message: `Attempted claim of ${claimedWeightKg} kg blocked on batch ${material.materialBatchId} (only ${availableKg} kg remaining).`,
          type: "ALERT",
          entityType: "RECOVERED_MATERIAL",
          entityId: material.materialBatchId,
        });

        res.status(400).json({
          success: false,
          error: `Claim rejected! Requested ${claimedWeightKg} kg exceeds remaining unallocated verified material (${availableKg} kg available). Duplicate or double-counting attempt prevented.`,
          availableKg,
        });
        return;
      }

      const count = await RecoveryClaimModel.countDocuments();
      const claimId = `CLAIM-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      // Submit on-chain via EWasteRegistry.sol
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.claimRecoveredMaterial(
          claimId,
          material.materialBatchId,
          claimedWeightKg,
          `${claimantName} (${claimantOrg})`
        );
      } catch (bcErr: any) {
        console.warn("Blockchain claim notice:", bcErr.message);
      }

      const claim = await RecoveryClaimModel.create({
        claimId,
        materialBatchId: material._id.toString(),
        claimantName,
        claimantOrg,
        claimedWeightKg,
        verified: true,
        notes,
        txHash,
      });

      await RecoveredMaterialModel.findByIdAndUpdate(material._id, {
        $inc: { claimedWeightKg },
      });

      await logAudit({
        userId: req.user!.id,
        action: "RECOVERY_CLAIM_APPROVED",
        entityType: "RECOVERY_CLAIM",
        entityId: claim.claimId,
        details: { claimedWeightKg, claimantOrg, txHash },
        ipAddress: req.ip,
      });

      await sendNotification({
        role: Role.ADMIN,
        title: "New Circularity Claim Submitted",
        message: `Claim ${claim.claimId} (${claimedWeightKg} kg) submitted by ${claimantName} (${claimantOrg}). Verified against certified stock.`,
        type: "SUCCESS",
        entityType: "RECOVERY_CLAIM",
        entityId: claim.claimId,
      });

      res.status(201).json({ success: true, claim });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/materials/claims
router.get("/claims", authenticateToken, async (req: Request, res: Response) => {
  try {
    const rawClaims = await RecoveryClaimModel.find({}).sort({ claimedAt: -1 }).lean();

    const claims = await Promise.all(
      rawClaims.map(async (c: any) => {
        const idStr = c._id.toString();
        const isMatMongoId = typeof c.materialBatchId === "string" && /^[0-9a-fA-F]{24}$/.test(c.materialBatchId);
        const material = (await RecoveredMaterialModel.findOne(
          isMatMongoId ? { $or: [{ _id: c.materialBatchId }, { materialBatchId: c.materialBatchId }] } : { materialBatchId: c.materialBatchId }
        ).lean()) as any;

        let populatedMat = null;
        if (material) {
          const isBatchMongoId = typeof material.sourceBatchId === "string" && /^[0-9a-fA-F]{24}$/.test(material.sourceBatchId);
          const sourceBatch = (await WasteBatchModel.findOne(
            isBatchMongoId ? { $or: [{ _id: material.sourceBatchId }, { batchId: material.sourceBatchId }] } : { batchId: material.sourceBatchId }
          ).lean()) as any;

          let populatedBatch = null;
          if (sourceBatch) {
            const cat = await WasteCategoryModel.findById(sourceBatch.categoryId).lean();
            populatedBatch = {
              ...sourceBatch,
              id: sourceBatch._id.toString(),
              category: cat ? { ...cat, id: (cat as any)._id.toString() } : null,
            };
          }

          populatedMat = {
            ...material,
            id: material._id.toString(),
            sourceBatch: populatedBatch,
          };
        }

        return {
          ...c,
          id: idStr,
          materialBatch: populatedMat,
        };
      })
    );

    res.json({ success: true, claims });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
