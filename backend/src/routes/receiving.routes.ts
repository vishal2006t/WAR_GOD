import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role, DispatchStatus, BatchStatus } from "@prisma/client";
import { blockchainService } from "../services/blockchain";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";

const router = Router();

const receiveDispatchSchema = z.object({
  dispatchId: z.string().uuid(),
  measuredWeightKg: z.number().positive(),
  acceptedWeightKg: z.number().nonnegative(),
  rejectedWeightKg: z.number().nonnegative().default(0),
  discrepancyReason: z.string().optional(),
  inspectionNotes: z.string().optional(),
  storageLocation: z.string().min(2),
  evidenceHash: z.string().optional(),
  isDisputed: z.boolean().default(false),
});

// GET /api/receiving/incoming
router.get("/incoming", authenticateToken, requireRole(Role.FACTORY, Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const where: any = {
      status: { in: [DispatchStatus.IN_TRANSIT, DispatchStatus.DELIVERED] },
    };

    if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
      where.destinationFacilityId = req.user!.facilityId;
    }

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        driver: { select: { fullName: true, phone: true } },
        batches: {
          include: {
            batch: { include: { category: true, dealer: { select: { fullName: true } } } },
          },
        },
        destinationFacility: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ success: true, incoming: dispatches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/receiving/history
router.get("/history", authenticateToken, requireRole(Role.FACTORY, Role.ADMIN), async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
      where.facilityId = req.user!.facilityId;
    }

    const records = await prisma.receivingRecord.findMany({
      where,
      include: {
        batch: { include: { category: true, dealer: { select: { fullName: true } } } },
        dispatch: { include: { driver: { select: { fullName: true } } } },
        facility: true,
        receiverUser: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, records });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/receiving/confirm
router.post(
  "/confirm",
  authenticateToken,
  requireRole(Role.FACTORY, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = receiveDispatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const {
        dispatchId,
        measuredWeightKg,
        acceptedWeightKg,
        rejectedWeightKg,
        discrepancyReason,
        inspectionNotes,
        storageLocation,
        evidenceHash,
        isDisputed,
      } = parse.data;

      // Accepted + Rejected cannot exceed measured weight
      if (acceptedWeightKg + rejectedWeightKg > measuredWeightKg + 0.05) {
        res.status(400).json({
          success: false,
          error: `Accepted weight (${acceptedWeightKg}kg) + Rejected weight (${rejectedWeightKg}kg) cannot exceed measured weight (${measuredWeightKg}kg).`,
        });
        return;
      }

      const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: { batches: { include: { batch: true } }, destinationFacility: true },
      });

      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      if (dispatch.status === DispatchStatus.RECEIVED) {
        res.status(400).json({ success: false, error: "Dispatch has already been received and confirmed." });
        return;
      }

      // Check for weight discrepancy between dispatched and received
      const weightDiff = Math.abs(dispatch.dispatchedWeightKg - measuredWeightKg);
      const hasDiscrepancy = weightDiff > 0.5 || isDisputed;

      if (hasDiscrepancy && !discrepancyReason) {
        res.status(400).json({
          success: false,
          error: `Weight difference detected (${weightDiff.toFixed(2)}kg discrepancy). A discrepancy reason is mandatory when weight difference exceeds tolerance.`,
        });
        return;
      }

      const finalStatus = hasDiscrepancy ? DispatchStatus.DISPUTED : DispatchStatus.RECEIVED;
      const batchStatus = hasDiscrepancy ? BatchStatus.DISPUTED : BatchStatus.RECEIVED;

      const proofHash = evidenceHash || computeSha256(dispatch.dispatchId + measuredWeightKg + (discrepancyReason || ""));

      // Record on Blockchain
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.recordReceiving(
          dispatch.dispatchId,
          measuredWeightKg,
          proofHash,
          hasDiscrepancy
        );
      } catch (bcErr: any) {
        console.warn("Blockchain receiving notice:", bcErr.message);
      }

      // Transactional updates
      const facilityId = req.user!.facilityId || dispatch.destinationFacilityId;

      const result = await prisma.$transaction(async (tx) => {
        // Update Dispatch
        const updatedDispatch = await tx.dispatch.update({
          where: { id: dispatchId },
          data: {
            status: finalStatus,
            receivedWeightKg: measuredWeightKg,
            discrepancyNotes: discrepancyReason,
            deliveryProofHash: proofHash,
            txHash,
          },
        });

        // Update all batches in dispatch
        for (const item of dispatch.batches) {
          await tx.wasteBatch.update({
            where: { id: item.batch.id },
            data: { status: batchStatus },
          });

          // Create Receiving Record for each batch
          await tx.receivingRecord.create({
            data: {
              batchId: item.batch.id,
              dispatchId: dispatch.id,
              facilityId,
              receiverUserId: req.user!.id,
              measuredWeightKg,
              acceptedWeightKg,
              rejectedWeightKg,
              isDisputed: hasDiscrepancy,
              discrepancyReason,
              inspectionNotes,
              storageLocation,
              evidenceHash: proofHash,
              txHash,
            },
          });
        }

        // Create Handover record
        await tx.handover.create({
          data: {
            dispatchId: dispatch.id,
            senderUserId: dispatch.driverId || req.user!.id,
            receiverUserId: req.user!.id,
            handoverType: "DELIVERY_CONFIRMATION",
            evidenceHash: proofHash,
            notes: hasDiscrepancy
              ? `Delivery received with dispute: ${discrepancyReason} (Dispatched: ${dispatch.dispatchedWeightKg}kg, Measured: ${measuredWeightKg}kg)`
              : `Delivery received and verified intact at ${storageLocation}`,
          },
        });

        return updatedDispatch;
      });

      await logAudit({
        userId: req.user!.id,
        action: hasDiscrepancy ? "RECEIVING_DISCREPANCY_FLAGGED" : "RECEIVING_CONFIRMED",
        entityType: "RECEIVING",
        entityId: dispatch.dispatchId,
        details: {
          dispatchedWeightKg: dispatch.dispatchedWeightKg,
          measuredWeightKg,
          acceptedWeightKg,
          hasDiscrepancy,
          discrepancyReason,
          txHash,
        },
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        dispatch: result,
        discrepancyFlagged: hasDiscrepancy,
        message: hasDiscrepancy
          ? "Shipment received with discrepancy flag recorded."
          : "Shipment successfully verified and received.",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
