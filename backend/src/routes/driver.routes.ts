import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../models/enums";
import { DriverModel, UserModel, DispatchModel, WasteBatchModel } from "../models";
import { logAudit } from "../services/audit";
import { sendNotification } from "../services/notification";

function buildDriverQuery(id: string) {
  const conds: any[] = [{ driverId: id.toUpperCase() }];
  if (mongoose.Types.ObjectId.isValid(id)) {
    conds.push({ _id: id });
  }
  return { $or: conds };
}

const router = Router();

// Validation Schemas
const createDriverSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").trim(),
  driverId: z.string().min(3).trim().optional(),
  email: z.string().email("Valid email required").trim().toLowerCase(),
  phone: z.string().min(8, "Valid phone number required").trim(),
  licenseNumber: z.string().trim().optional(),
  vehicleType: z.string().min(2, "Vehicle type is required").trim(),
  vehicleRegistration: z.string().min(4, "Vehicle registration must be at least 4 characters").trim().toUpperCase(),
  loadCapacityKg: z.number().positive("Load capacity must be greater than 0 kg"),
  availability: z.enum(["AVAILABLE", "ON_TRIP", "MAINTENANCE", "OFF_DUTY"]).optional(),
  notes: z.string().optional(),
});

const updateDriverSchema = z.object({
  fullName: z.string().min(2).trim().optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  phone: z.string().min(8).trim().optional(),
  licenseNumber: z.string().trim().optional(),
  vehicleType: z.string().min(2).trim().optional(),
  vehicleRegistration: z.string().min(4).trim().toUpperCase().optional(),
  loadCapacityKg: z.number().positive().optional(),
  availability: z.enum(["AVAILABLE", "ON_TRIP", "MAINTENANCE", "OFF_DUTY"]).optional(),
  notes: z.string().optional(),
});

// Helper to seed initial drivers if collection is empty
export async function ensureDefaultDrivers() {
  try {
    const count = await DriverModel.countDocuments();
    if (count === 0) {
      const userDriver = await UserModel.findOne({ role: Role.DRIVER, email: "driver@greenlogistics.com" }).lean();
      await DriverModel.create([
        {
          driverId: "DRV-2026-001",
          userId: userDriver ? (userDriver as any)._id.toString() : undefined,
          fullName: userDriver?.fullName || "Rajesh Kumar (Heavy Fleet Driver)",
          email: userDriver?.email || "driver@greenlogistics.com",
          phone: userDriver?.phone || "+91 90000 00003",
          licenseNumber: "DL-KA-04-2019-8871",
          vehicleType: "Heavy Electric E-Truck",
          vehicleRegistration: "KA-01-EQ-9988",
          loadCapacityKg: 5000,
          availability: "AVAILABLE",
          notes: "Primary dedicated heavy carrier for Bangalore Urban & Industrial zones",
        },
        {
          driverId: "DRV-2026-002",
          fullName: "Siddharth Varma (Express Logistics)",
          email: "siddharth.varma@greenlogistics.com",
          phone: "+91 98450 77112",
          licenseNumber: "DL-KA-05-2021-4432",
          vehicleType: "Medium Transit Electric Van",
          vehicleRegistration: "KA-04-EV-2026",
          loadCapacityKg: 2000,
          availability: "AVAILABLE",
          notes: "Rapid collection van equipped with calibrated onboard scale",
        },
        {
          driverId: "DRV-2026-003",
          fullName: "Manish Reddy (Regional Hauler)",
          email: "manish.reddy@greenlogistics.com",
          phone: "+91 99001 22334",
          licenseNumber: "DL-KA-51-2017-9102",
          vehicleType: "Heavy Flatbed Carrier",
          vehicleRegistration: "KA-51-TR-4401",
          loadCapacityKg: 8000,
          availability: "AVAILABLE",
          notes: "Inter-facility bulk transfer vehicle for disassembled batches",
        },
      ]);
    }
  } catch (err) {
    console.error("Error ensuring default drivers:", err);
  }
}

// GET /api/drivers - List drivers with search, filter, pagination
router.get("/", authenticateToken, requireRole(Role.ADMIN, Role.DEALER, Role.FACTORY), async (req: Request, res: Response) => {
  try {
    await ensureDefaultDrivers();

    const search = req.query.search as string;
    const availability = req.query.availability as string;
    const vehicleType = req.query.vehicleType as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const query: any = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { driverId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { vehicleRegistration: { $regex: search, $options: "i" } },
      ];
    }

    if (availability && availability !== "ALL") {
      query.availability = availability;
    }

    if (vehicleType && vehicleType !== "ALL") {
      query.vehicleType = { $regex: vehicleType, $options: "i" };
    }

    const total = await DriverModel.countDocuments(query);
    const rawDrivers = await DriverModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich with live active dispatch info
    const drivers = await Promise.all(
      rawDrivers.map(async (d: any) => {
        const idStr = d._id.toString();
        // Check active dispatch
        const activeDispatch = await DispatchModel.findOne({
          $or: [{ driverId: idStr }, { driverId: d.userId }, { driverId: d.driverId }],
          status: { $in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] },
        }).lean();

        // Calculate total completed
        const completedCount = await DispatchModel.countDocuments({
          $or: [{ driverId: idStr }, { driverId: d.userId }, { driverId: d.driverId }],
          status: { $in: ["DELIVERED", "RECEIVED"] },
        });

        return {
          ...d,
          id: idStr,
          currentAssignment: activeDispatch
            ? {
                id: (activeDispatch as any)._id.toString(),
                dispatchId: activeDispatch.dispatchId,
                status: activeDispatch.status,
                weightKg: activeDispatch.dispatchedWeightKg,
                pickupAddress: activeDispatch.pickupAddress,
              }
            : null,
          completedTripsCount: completedCount,
        };
      })
    );

    res.json({
      success: true,
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drivers/eligible - Retrieve available drivers matching payload criteria
router.get("/eligible", authenticateToken, requireRole(Role.ADMIN, Role.DEALER), async (req: Request, res: Response) => {
  try {
    await ensureDefaultDrivers();
    const weightKg = parseFloat(req.query.weightKg as string) || 0;

    const query: any = { availability: "AVAILABLE" };
    if (weightKg > 0) {
      query.loadCapacityKg = { $gte: weightKg };
    }

    const rawDrivers = await DriverModel.find(query).sort({ loadCapacityKg: 1 }).lean();
    const drivers = rawDrivers.map((d: any) => ({
      ...d,
      id: d._id.toString(),
    }));

    res.json({ success: true, drivers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drivers/me - Retrieve currently authenticated driver's profile & active duty status
router.get("/me", authenticateToken, requireRole(Role.DRIVER, Role.ADMIN), async (req: Request, res: Response) => {
  try {
    let driver = await DriverModel.findOne({ userId: req.user!.id }).lean();
    if (!driver) {
      // Check UserModel fallback
      const user = await UserModel.findById(req.user!.id).lean();
      if (!user) {
        return res.status(404).json({ success: false, error: "Driver profile not found." });
      }
      return res.json({
        success: true,
        driver: {
          id: user._id.toString(),
          userId: user._id.toString(),
          driverId: "DRV-SELF",
          fullName: user.fullName,
          phone: user.phone || "+91 98450 12345",
          email: user.email,
          vehicleRegistration: "KA-04-ET-8822",
          vehicleType: "HEAVY_TRUCK",
          availability: "AVAILABLE",
          loadCapacityKg: 5000,
          licenseNumber: "DL-KA-2022-7711",
          rating: 4.9,
          totalCompletedTrips: 12,
        },
      });
    }

    const idStr = (driver as any)._id.toString();
    const activeDispatch = await DispatchModel.findOne({
      $or: [{ driverId: idStr }, { driverId: driver.userId }, { driverId: driver.driverId }],
      status: { $in: ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ON_BREAK", "ARRIVED_AT_FACTORY"] },
    }).lean();

    const completedTripsCount = await DispatchModel.countDocuments({
      $or: [{ driverId: idStr }, { driverId: driver.userId }, { driverId: driver.driverId }],
      status: { $in: ["DELIVERED", "RECEIVED"] },
    });

    res.json({
      success: true,
      driver: {
        ...driver,
        id: idStr,
        currentAssignment: activeDispatch
          ? {
              id: (activeDispatch as any)._id.toString(),
              dispatchId: activeDispatch.dispatchId,
              status: activeDispatch.status,
              weightKg: activeDispatch.dispatchedWeightKg,
              pickupAddress: activeDispatch.pickupAddress,
            }
          : null,
        completedTripsCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drivers/:id - Retrieve driver details with assignment history & statistics
router.get("/:id", authenticateToken, requireRole(Role.ADMIN, Role.DEALER, Role.FACTORY), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const driver = await DriverModel.findOne(buildDriverQuery(id)).lean();

    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver profile not found." });
    }

    const driverId = (driver as any)._id.toString();
    const queryIds = [driverId];
    if (driver.userId) queryIds.push(driver.userId);
    if (driver.driverId) queryIds.push(driver.driverId);

    // Fetch all dispatches for this driver
    const rawDispatches = await DispatchModel.find({
      driverId: { $in: queryIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    const dispatches = await Promise.all(
      rawDispatches.map(async (d: any) => {
        const batches = await WasteBatchModel.find({
          $or: [{ _id: { $in: d.batchIds || [] } }, { batchId: { $in: d.batchIds || [] } }],
        }).lean();

        return {
          id: d._id.toString(),
          dispatchId: d.dispatchId,
          status: d.status,
          dispatchedWeightKg: d.dispatchedWeightKg,
          pickupWeightKg: d.pickupWeightKg,
          deliveryWeightKg: d.deliveryWeightKg,
          pickupAddress: d.pickupAddress,
          vehicleRegistration: d.vehicleRegistration,
          createdAt: d.createdAt,
          deliveryTime: d.deliveryTime,
          rejectionReason: d.rejectionReason,
          exceptionReason: d.exceptionReason,
          txHash: d.txHash,
          batches: batches.map((b: any) => ({
            id: b._id.toString(),
            batchId: b.batchId,
            initialWeightKg: b.initialWeightKg,
            status: b.status,
          })),
        };
      })
    );

    // Calculate real performance stats
    const totalDispatches = dispatches.length;
    const completedShipments = dispatches.filter((d) => ["DELIVERED", "RECEIVED"].includes(d.status)).length;
    const activeShipments = dispatches.filter((d) =>
      ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "PICKED_UP", "IN_TRANSIT"].includes(d.status)
    ).length;
    const disputedShipments = dispatches.filter((d) => ["DISPUTED", "EXCEPTION"].includes(d.status)).length;
    const totalWeightKg = dispatches.reduce((acc, d) => acc + (d.dispatchedWeightKg || 0), 0);

    const activeDispatch = dispatches.find((d) =>
      ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "PICKED_UP", "IN_TRANSIT"].includes(d.status)
    );

    res.json({
      success: true,
      driver: {
        ...driver,
        id: driverId,
        stats: {
          totalDispatches,
          completedShipments,
          activeShipments,
          disputedShipments,
          totalWeightTransportedKg: Number(totalWeightKg.toFixed(2)),
          completionRate: totalDispatches > 0 ? Number(((completedShipments / totalDispatches) * 100).toFixed(1)) : 100,
        },
        currentAssignment: activeDispatch || null,
        history: dispatches,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/drivers - Register new driver
router.post("/", authenticateToken, requireRole(Role.ADMIN, Role.DEALER), async (req: Request, res: Response) => {
  try {
    const validated = createDriverSchema.parse(req.body);

    // Generate driver ID if not provided
    let driverId = validated.driverId?.toUpperCase();
    if (!driverId) {
      const count = await DriverModel.countDocuments();
      driverId = `DRV-2026-${String(count + 101).padStart(4, "0")}`;
    }

    // Uniqueness validation
    const existingId = await DriverModel.findOne({ driverId });
    if (existingId) {
      return res.status(400).json({ success: false, error: `Driver ID '${driverId}' is already registered.` });
    }

    const existingReg = await DriverModel.findOne({ vehicleRegistration: validated.vehicleRegistration });
    if (existingReg) {
      return res.status(400).json({
        success: false,
        error: `Vehicle registration '${validated.vehicleRegistration}' is already registered with another driver.`,
      });
    }

    const newDriver = await DriverModel.create({
      ...validated,
      driverId,
      availability: validated.availability || "AVAILABLE",
      createdBy: req.user!.id,
    });

    await logAudit({
      userId: req.user!.id,
      action: "DRIVER_REGISTERED",
      entityType: "DRIVER",
      entityId: newDriver.driverId,
      details: {
        fullName: newDriver.fullName,
        vehicleRegistration: newDriver.vehicleRegistration,
        loadCapacityKg: newDriver.loadCapacityKg,
      },
      ipAddress: req.ip || "127.0.0.1",
    });

    await sendNotification({
      role: Role.ADMIN,
      title: "New Fleet Driver Registered",
      message: `Driver ${newDriver.fullName} (${newDriver.driverId}) registered with vehicle ${newDriver.vehicleRegistration}.`,
      type: "INFO",
      entityType: "DRIVER",
      entityId: newDriver.driverId,
    });

    res.status(201).json({
      success: true,
      message: "Driver registered successfully.",
      driver: { ...newDriver.toObject(), id: newDriver._id.toString() },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/drivers/:id - Update driver profile
router.put("/:id", authenticateToken, requireRole(Role.ADMIN, Role.DEALER), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateDriverSchema.parse(req.body);

    const driver = await DriverModel.findOne(buildDriverQuery(id));

    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver not found." });
    }

    // Check duplicate vehicle registration if changed
    if (validated.vehicleRegistration && validated.vehicleRegistration !== driver.vehicleRegistration) {
      const duplicateReg = await DriverModel.findOne({
        vehicleRegistration: validated.vehicleRegistration,
        _id: { $ne: driver._id },
      });
      if (duplicateReg) {
        return res.status(400).json({
          success: false,
          error: `Vehicle registration '${validated.vehicleRegistration}' is already registered to another driver.`,
        });
      }
    }

    Object.assign(driver, validated);
    await driver.save();

    await logAudit({
      userId: req.user!.id,
      action: "DRIVER_UPDATED",
      entityType: "DRIVER",
      entityId: driver.driverId,
      details: validated,
      ipAddress: req.ip || "127.0.0.1",
    });

    res.json({
      success: true,
      message: "Driver profile updated successfully.",
      driver: { ...driver.toObject(), id: driver._id.toString() },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/drivers/:id/availability - Update driver availability status
router.patch("/:id/availability", authenticateToken, requireRole(Role.ADMIN, Role.DEALER, Role.DRIVER), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { availability } = req.body;

    if (!["AVAILABLE", "ON_TRIP", "MAINTENANCE", "OFF_DUTY"].includes(availability)) {
      return res.status(400).json({
        success: false,
        error: "Invalid availability status. Must be AVAILABLE, ON_TRIP, MAINTENANCE, or OFF_DUTY.",
      });
    }

    const driver = await DriverModel.findOne(buildDriverQuery(id));

    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver not found." });
    }

    // Role security check: DRIVER can only toggle their own availability
    if (req.user!.role === Role.DRIVER) {
      const isOwnRecord =
        (driver.userId && String(driver.userId) === String(req.user!.id)) ||
        (driver as any)._id.toString() === String(req.user!.id) ||
        driver.driverId === req.user!.id;

      if (!isOwnRecord) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: You can only update your own duty availability.",
        });
      }

      if (!["AVAILABLE", "OFF_DUTY"].includes(availability)) {
        return res.status(400).json({
          success: false,
          error: "Drivers can only toggle duty status between AVAILABLE and OFF_DUTY.",
        });
      }

      if (driver.availability === "ON_TRIP" && availability === "OFF_DUTY") {
        return res.status(400).json({
          success: false,
          error: "Cannot go OFF_DUTY while on an active trip. Complete your active shipment first.",
        });
      }
    }

    const previousStatus = driver.availability;
    driver.availability = availability;
    await driver.save();

    await logAudit({
      userId: req.user!.id,
      action: "DRIVER_AVAILABILITY_CHANGED",
      entityType: "DRIVER",
      entityId: driver.driverId,
      details: { previousStatus, newStatus: availability },
      ipAddress: req.ip || "127.0.0.1",
    });

    res.json({
      success: true,
      message: `Driver availability updated to ${availability}.`,
      driver: { ...driver.toObject(), id: driver._id.toString() },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/drivers/:id - Safe delete driver
router.delete("/:id", authenticateToken, requireRole(Role.ADMIN, Role.DEALER), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const driver = await DriverModel.findOne(buildDriverQuery(id));

    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver not found." });
    }

    const driverId = (driver as any)._id.toString();
    const queryIds = [driverId];
    if (driver.userId) queryIds.push(driver.userId);
    if (driver.driverId) queryIds.push(driver.driverId);

    // Check historical dispatches
    const dispatchesCount = await DispatchModel.countDocuments({
      driverId: { $in: queryIds },
    });

    if (dispatchesCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete driver '${driver.fullName}' (${driver.driverId}): referenced by ${dispatchesCount} historical dispatch shipment(s). You can change their availability to OFF_DUTY or MAINTENANCE instead.`,
      });
    }

    await DriverModel.deleteOne({ _id: driver._id });

    await logAudit({
      userId: req.user!.id,
      action: "DRIVER_DELETED",
      entityType: "DRIVER",
      entityId: driver.driverId,
      details: { fullName: driver.fullName },
      ipAddress: req.ip || "127.0.0.1",
    });

    res.json({
      success: true,
      message: `Driver ${driver.fullName} (${driver.driverId}) removed successfully.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
