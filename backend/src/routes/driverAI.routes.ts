import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role, DriverAvailability } from "../models";
import { driverAIService } from "../services/driverAI";

const router = Router();

const setModeSchema = z.object({
  mode: z.enum(["AI", "MANUAL"]),
  notes: z.string().optional(),
  scope: z.string().optional().default("GLOBAL"),
});

const manualAssignSchema = z.object({
  dispatchId: z.string().optional(),
  pickupTaskId: z.string().optional(),
  driverId: z.string().min(1, "driverId is required"),
  vehicleRegistration: z.string().optional(),
  vehicleType: z.string().optional(),
  overrideReason: z.string().optional(),
});

const updateDriverStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_TRIP", "MAINTENANCE", "OFF_DUTY"]),
  notes: z.string().optional(),
});

// GET /api/driver-ai/mode - Get current operating mode
router.get("/mode", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = (req.query.scope as string) || "GLOBAL";
    const modeInfo = await driverAIService.getOperatingMode(scope);
    res.json({
      success: true,
      data: modeInfo,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to get operating mode" });
  }
});

// POST /api/driver-ai/mode - Set operating mode (AI vs MANUAL)
router.post(
  "/mode",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = setModeSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const { mode, notes, scope } = parse.data;
      const user = req.user!;

      const result = await driverAIService.setOperatingMode(
        mode,
        user.id,
        user.role,
        user.fullName,
        notes,
        scope
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to set operating mode" });
    }
  }
);

// GET /api/driver-ai/drivers - Get all real drivers with active status & trip counts
router.get("/drivers", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await driverAIService.getRealDriversWithActiveStatus();
    const modeInfo = await driverAIService.getOperatingMode();

    res.json({
      success: true,
      data: {
        drivers,
        total: drivers.length,
        availableCount: drivers.filter((d) => d.availability === "AVAILABLE").length,
        onTripCount: drivers.filter((d) => d.availability === "ON_TRIP").length,
        maintenanceCount: drivers.filter((d) => d.availability === "MAINTENANCE").length,
        offDutyCount: drivers.filter((d) => d.availability === "OFF_DUTY").length,
        operatingMode: modeInfo.mode,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve drivers" });
  }
});

// GET /api/driver-ai/recommendations - AI/heuristics driver assignment recommendations
router.get("/recommendations", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { requiredWeightKg, pickupLocation, preferredVehicleType } = req.query;

    const result = await driverAIService.getDriverRecommendations({
      requiredWeightKg: requiredWeightKg ? Number(requiredWeightKg) : undefined,
      pickupLocation: pickupLocation as string | undefined,
      preferredVehicleType: preferredVehicleType as string | undefined,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to get driver recommendations" });
  }
});

// POST /api/driver-ai/manual-assign - Manual driver assignment (Independent Manual Mode)
router.post(
  "/manual-assign",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parse = manualAssignSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const user = req.user!;
      const result = await driverAIService.manualAssignDriver({
        ...parse.data,
        assignedByUserId: user.id,
        assignedByRole: user.role,
        assignedByName: user.fullName,
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || "Manual assignment failed" });
    }
  }
);

// POST /api/driver-ai/ai-optimize - Run QpiAI optimization
router.post(
  "/ai-optimize",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { batchIds, destination, forceAI } = req.body;

      const result = await driverAIService.runAiOptimization({
        batchIds,
        destination,
        userId: user.id,
        userRole: user.role,
        forceAI: !!forceAI,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "AI optimization failed" });
    }
  }
);

// PATCH /api/driver-ai/drivers/:driverId/status - Update driver availability status
router.patch(
  "/drivers/:driverId/status",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER, Role.DRIVER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { driverId } = req.params;
      const parse = updateDriverStatusSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const user = req.user!;
      const result = await driverAIService.updateDriverStatus(
        driverId,
        parse.data.status,
        user.id,
        user.role,
        parse.data.notes
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || "Failed to update driver status" });
    }
  }
);

export default router;
