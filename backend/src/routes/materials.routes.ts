import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "@prisma/client";
import { blockchainService } from "../services/blockchain";
import { logAudit } from "../services/audit";

const router = Router();

const claimSchema = z.object({
  materialBatchId: z.string().uuid(),
  claimedWeightKg: z.number().positive(),
  claimantName: z.string().min(2),
  claimantOrg: z.string().min(2),
  notes: z.string().optional(),
});

// GET /api/materials (List recovered materials)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const materials = await prisma.recoveredMaterial.findMany({
      include: {
        sourceBatch: { include: { category: true, destinationFacility: true } },
        processingRecord: { include: { workerUser: { select: { fullName: true } } } },
        claims: true,
      },
      orderBy: { createdAt: "desc" },
    });

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

      const material = await prisma.recoveredMaterial.findUnique({
        where: { id: materialBatchId },
      });

      if (!material) {
        res.status(404).json({ success: false, error: "Recovered material batch not found" });
        return;
      }

      const availableKg = Number((material.recoveredWeightKg - material.claimedWeightKg).toFixed(3));

      // DUPLICATE / OVER-CLAIM PREVENTION
      if (claimedWeightKg > availableKg) {
        // Log duplicate/excessive claim alert in audit trail!
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

        res.status(400).json({
          success: false,
          error: `Claim rejected! Requested ${claimedWeightKg} kg exceeds remaining unallocated verified material (${availableKg} kg available). Duplicate or double-counting attempt prevented.`,
          availableKg,
        });
        return;
      }

      const count = await prisma.recoveryClaim.count();
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

      const claim = await prisma.$transaction(async (tx) => {
        const c = await tx.recoveryClaim.create({
          data: {
            claimId,
            materialBatchId: material.id,
            claimantName,
            claimantOrg,
            claimedWeightKg,
            verified: true,
            notes,
            txHash,
          },
        });

        await tx.recoveredMaterial.update({
          where: { id: material.id },
          data: {
            claimedWeightKg: { increment: claimedWeightKg },
          },
        });

        return c;
      });

      await logAudit({
        userId: req.user!.id,
        action: "RECOVERY_CLAIM_APPROVED",
        entityType: "RECOVERY_CLAIM",
        entityId: claim.claimId,
        details: { claimedWeightKg, claimantOrg, txHash },
        ipAddress: req.ip,
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
    const claims = await prisma.recoveryClaim.findMany({
      include: {
        materialBatch: {
          include: { sourceBatch: { include: { category: true } } },
        },
      },
      orderBy: { claimedAt: "desc" },
    });

    res.json({ success: true, claims });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
