import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role, DispatchStatus, BatchStatus } from "@prisma/client";
import { blockchainService } from "../services/blockchain";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";

const router = Router();

const createDispatchSchema = z.object({
  batchIds: z.array(z.string()).min(1),
  driverId: z.string().uuid(),
  vehicleRegistration: z.string().min(4),
  pickupAddress: z.string().min(5),
  destinationFacilityId: z.string().uuid(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(DispatchStatus),
  proofHash: z.string().optional(),
  discrepancyNotes: z.string().optional(),
});

// GET /api/dispatches
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.user!.role === Role.DRIVER) {
      where.driverId = req.user!.id;
    } else if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
      where.destinationFacilityId = req.user!.facilityId;
    }

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true, phone: true, organization: true } },
        destinationFacility: true,
        batches: {
          include: {
            batch: {
              include: { category: true, dealer: { select: { fullName: true } } },
            },
          },
        },
        handovers: true,
        receivingRecord: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, dispatches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dispatches/drivers (for dealer/admin to assign driver)
router.get("/drivers", authenticateToken, async (req: Request, res: Response) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: Role.DRIVER, status: "APPROVED" },
      select: { id: true, fullName: true, phone: true, organization: true },
    });
    res.json({ success: true, drivers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dispatches (Create dispatch & assign driver)
router.post(
  "/",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = createDispatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const { batchIds, driverId, vehicleRegistration, pickupAddress, destinationFacilityId } = parse.data;

      // Verify batches
      const batches = await prisma.wasteBatch.findMany({
        where: { id: { in: batchIds } },
      });

      if (batches.length !== batchIds.length) {
        res.status(400).json({ success: false, error: "One or more batch IDs are invalid" });
        return;
      }

      for (const b of batches) {
        if (b.status !== BatchStatus.REGISTERED) {
          res.status(400).json({
            success: false,
            error: `Batch ${b.batchId} cannot be dispatched because its status is already ${b.status}`,
          });
          return;
        }
      }

      const totalDispatchedWeightKg = batches.reduce((acc, b) => acc + b.initialWeightKg, 0);

      const count = await prisma.dispatch.count();
      const dispatchId = `DISP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const proofHash = computeSha256(dispatchId + vehicleRegistration + totalDispatchedWeightKg);

      // On-chain registration
      let txHash: string | null = null;
      try {
        txHash = await blockchainService.recordDispatch(
          dispatchId,
          batches.map((b) => b.batchId),
          driverId,
          vehicleRegistration,
          totalDispatchedWeightKg,
          proofHash
        );
      } catch (bcErr: any) {
        console.warn("Blockchain dispatch notice:", bcErr.message);
      }

      // Database transaction
      const dispatch = await prisma.$transaction(async (tx) => {
        const d = await tx.dispatch.create({
          data: {
            dispatchId,
            driverId,
            vehicleRegistration,
            pickupAddress,
            destinationFacilityId,
            dispatchedWeightKg: totalDispatchedWeightKg,
            status: DispatchStatus.ASSIGNED,
            pickupProofHash: proofHash,
            txHash,
          },
        });

        for (const b of batches) {
          await tx.dispatchBatch.create({
            data: {
              dispatchId: d.id,
              batchId: b.id,
            },
          });

          await tx.wasteBatch.update({
            where: { id: b.id },
            data: { status: BatchStatus.DISPATCHED },
          });
        }

        await tx.handover.create({
          data: {
            dispatchId: d.id,
            senderUserId: req.user!.id,
            receiverUserId: driverId,
            handoverType: "ASSIGNMENT",
            evidenceHash: proofHash,
            notes: `Dispatched ${batches.length} batches (${totalDispatchedWeightKg} kg) assigned to driver.`,
          },
        });

        return d;
      });

      await logAudit({
        userId: req.user!.id,
        action: "DISPATCH_CREATED",
        entityType: "DISPATCH",
        entityId: dispatch.dispatchId,
        details: { dispatchedWeightKg: totalDispatchedWeightKg, vehicleRegistration, txHash },
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, dispatch });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// PATCH /api/dispatches/:id/status (Driver updating status)
router.patch(
  "/:id/status",
  authenticateToken,
  requireRole(Role.DRIVER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parse = updateStatusSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const { status, proofHash, discrepancyNotes } = parse.data;

      const dispatch = await prisma.dispatch.findUnique({
        where: { id },
        include: { batches: true },
      });

      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      // If driver, ensure driver is assigned
      if (req.user!.role === Role.DRIVER && dispatch.driverId !== req.user!.id) {
        res.status(403).json({ success: false, error: "You are not assigned to this dispatch." });
        return;
      }

      // Valid workflow transitions:
      // ASSIGNED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
      const validTransitions: Record<DispatchStatus, DispatchStatus[]> = {
        REGISTERED: [DispatchStatus.ASSIGNED],
        ASSIGNED: [DispatchStatus.PICKED_UP],
        PICKED_UP: [DispatchStatus.IN_TRANSIT],
        IN_TRANSIT: [DispatchStatus.DELIVERED, DispatchStatus.DISPUTED],
        DELIVERED: [DispatchStatus.RECEIVED, DispatchStatus.DISPUTED],
        RECEIVED: [],
        DISPUTED: [],
      };

      const allowed = validTransitions[dispatch.status];
      if (!allowed.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid transition from '${dispatch.status}' to '${status}'. Expected one of: ${allowed.join(", ")}`,
        });
        return;
      }

      const updateData: any = { status };
      if (status === DispatchStatus.PICKED_UP) {
        updateData.pickupTime = new Date();
        if (proofHash) updateData.pickupProofHash = proofHash;
      } else if (status === DispatchStatus.DELIVERED) {
        updateData.deliveryTime = new Date();
        if (proofHash) updateData.deliveryProofHash = proofHash;
      }

      if (discrepancyNotes) {
        updateData.discrepancyNotes = discrepancyNotes;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.dispatch.update({
          where: { id },
          data: updateData,
        });

        // Record Handover event
        await tx.handover.create({
          data: {
            dispatchId: d.id,
            senderUserId: req.user!.id,
            handoverType: status,
            evidenceHash: proofHash || null,
            notes: discrepancyNotes || `Dispatch updated to ${status}`,
          },
        });

        return d;
      });

      await logAudit({
        userId: req.user!.id,
        action: `DISPATCH_STATUS_${status}`,
        entityType: "DISPATCH",
        entityId: dispatch.dispatchId,
        details: { previousStatus: dispatch.status, newStatus: status, discrepancyNotes },
        ipAddress: req.ip,
      });

      res.json({ success: true, dispatch: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
