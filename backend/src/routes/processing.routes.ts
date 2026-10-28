import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role, BatchStatus } from "@prisma/client";
import { blockchainService } from "../services/blockchain";
import { validateMassBalance } from "../utils/massBalance";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";

const router = Router();

const processingSchema = z.object({
  sourceBatchId: z.string().uuid(),
  inputWeightKg: z.number().positive(),
  materials: z.array(
    z.object({
      materialType: z.string().min(2),
      weightKg: z.number().positive(),
      purityPercentage: z.number().min(0).max(100).default(99.0),
      location: z.string().default("Facility Smelting Vault"),
    })
  ).min(1),
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
        status: { in: [BatchStatus.RECEIVED, BatchStatus.DISPUTED] },
      };

      if (req.user!.role === Role.WORKER && req.user!.facilityId) {
        where.destinationFacilityId = req.user!.facilityId;
      }

      const batches = await prisma.wasteBatch.findMany({
        where,
        include: {
          category: true,
          receivingRecord: true,
          destinationFacility: true,
        },
        orderBy: { createdAt: "desc" },
      });

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

      const records = await prisma.processingRecord.findMany({
        where,
        include: {
          sourceBatch: { include: { category: true } },
          workerUser: { select: { fullName: true } },
          supervisorUser: { select: { fullName: true } },
          facility: true,
          recoveredMaterials: {
            include: { claims: true },
          },
        },
        orderBy: { processedAt: "desc" },
      });

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
      const batch = await prisma.wasteBatch.findUnique({
        where: { id: sourceBatchId },
        include: { destinationFacility: true },
      });

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
        // Strict hackathon requirement: Flag or reject unexplained mismatches!
        res.status(422).json({
          success: false,
          error: "Mass-balance validation failed! The quantities do not balance.",
          massBalance,
        });
        return;
      }

      const count = await prisma.processingRecord.count();
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

      const record = await prisma.$transaction(async (tx) => {
        const proc = await tx.processingRecord.create({
          data: {
            processingId,
            sourceBatchId: batch.id,
            facilityId,
            workerUserId: req.user!.id,
            inputWeightKg,
            totalRecoveredKg: massBalance.totalRecoveredKg,
            residualKg,
            documentedLossKg,
            massBalanceValid: true,
            supervisorApproved: req.user!.role === Role.ADMIN, // Admin auto-approves, worker awaits supervisor
            notes,
            evidenceHash: computedHash,
            txHash,
          },
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

          await tx.recoveredMaterial.create({
            data: {
              materialBatchId: matBatchId,
              sourceBatchId: batch.id,
              processingRecordId: proc.id,
              materialType: mat.materialType,
              recoveredWeightKg: mat.weightKg,
              purityPercentage: mat.purityPercentage,
              location: mat.location,
              evidenceHash: matHash,
              txHash: matTxHash,
            },
          });
        }

        // Update batch status
        await tx.wasteBatch.update({
          where: { id: batch.id },
          data: { status: BatchStatus.PROCESSED },
        });

        return proc;
      });

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

      const record = await prisma.processingRecord.update({
        where: { id },
        data: {
          supervisorApproved: approved,
          supervisorRemarks: remarks,
          supervisorUserId: req.user!.id,
        },
      });

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
