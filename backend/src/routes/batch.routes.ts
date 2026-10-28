import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role, BatchStatus } from "@prisma/client";
import { blockchainService } from "../services/blockchain";
import { generateQrCodeDataUrl } from "../utils/qr";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";

const router = Router();

const createBatchSchema = z.object({
  categoryId: z.string().uuid(),
  destinationFacilityId: z.string().uuid(),
  pickupLocation: z.string().min(3),
  sourceType: z.string().min(2),
  description: z.string().min(5),
  initialWeightKg: z.number().positive(),
  evidenceHash: z.string().optional(),
  weighingSlipUrl: z.string().optional(),
});

// GET /api/batches/categories
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await prisma.wasteCategory.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, categories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/batches/facilities
router.get("/facilities", async (req: Request, res: Response) => {
  try {
    const facilities = await prisma.facility.findMany({
      where: { authorized: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, facilities });
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
        sourceType,
        description,
        initialWeightKg,
        evidenceHash,
        weighingSlipUrl,
      } = parse.data;

      // Verify category and facility
      const category = await prisma.wasteCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        res.status(404).json({ success: false, error: "Waste category not found" });
        return;
      }

      const facility = await prisma.facility.findUnique({ where: { id: destinationFacilityId } });
      if (!facility || !facility.authorized) {
        res.status(400).json({ success: false, error: "Selected receiving facility is not authorized" });
        return;
      }

      // Generate unique human-readable Batch ID
      const count = await prisma.wasteBatch.count();
      const batchId = `BATCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const computedHash = evidenceHash || computeSha256(batchId + pickupLocation + initialWeightKg);

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

      const batch = await prisma.wasteBatch.create({
        data: {
          batchId,
          dealerId: req.user!.id,
          categoryId,
          destinationFacilityId,
          pickupLocation,
          sourceType,
          description,
          initialWeightKg,
          status: BatchStatus.REGISTERED,
          evidenceHash: computedHash,
          weighingSlipUrl,
          qrCodeData,
          txHash,
        },
        include: {
          category: true,
          destinationFacility: true,
          dealer: { select: { fullName: true, organization: true } },
        },
      });

      await logAudit({
        userId: req.user!.id,
        action: "BATCH_REGISTERED",
        entityType: "BATCH",
        entityId: batch.batchId,
        details: { initialWeightKg, destinationFacility: facility.name, txHash },
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, batch });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/batches (List batches with role and status filtering)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, categoryId, facilityId } = req.query;

    const where: any = {};
    if (status) where.status = status as BatchStatus;
    if (categoryId) where.categoryId = String(categoryId);
    if (facilityId) where.destinationFacilityId = String(facilityId);

    // If dealer, show their batches unless admin
    if (req.user!.role === Role.DEALER) {
      where.dealerId = req.user!.id;
    } else if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
      where.destinationFacilityId = req.user!.facilityId;
    }

    const batches = await prisma.wasteBatch.findMany({
      where,
      include: {
        category: true,
        destinationFacility: true,
        dealer: { select: { fullName: true, organization: true } },
        receivingRecord: true,
        processingRecords: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, batches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/batches/:batchId (Detail & Full Provenance)
router.get("/:batchId", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const batch = await prisma.wasteBatch.findUnique({
      where: { batchId },
      include: {
        category: true,
        destinationFacility: true,
        dealer: { select: { id: true, fullName: true, organization: true, email: true } },
        dispatches: {
          include: {
            dispatch: {
              include: {
                driver: { select: { fullName: true, phone: true } },
                handovers: true,
              },
            },
          },
        },
        receivingRecord: {
          include: {
            receiverUser: { select: { fullName: true } },
            facility: true,
          },
        },
        processingRecords: {
          include: {
            workerUser: { select: { fullName: true } },
            supervisorUser: { select: { fullName: true } },
            recoveredMaterials: true,
          },
        },
        recoveredMaterials: {
          include: {
            claims: true,
          },
        },
        refurbishedProducts: true,
      },
    });

    if (!batch) {
      res.status(404).json({ success: false, error: "Batch not found" });
      return;
    }

    res.json({ success: true, batch });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
