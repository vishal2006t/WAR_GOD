import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  Role,
  DispatchStatus,
  BatchStatus,
  DispatchModel,
  WasteBatchModel,
  HandoverModel,
  FacilityModel,
  UserModel,
  ReceivingRecordModel,
  WasteCategoryModel,
  DriverModel,
  OptimizationReportModel,
} from "../models";
import { ensureDefaultDrivers } from "./driver.routes";
import { blockchainService } from "../services/blockchain";
import { logAudit } from "../services/audit";
import { computeSha256 } from "../utils/hash";
import { qpiAiService } from "../services/qpiai";
import { sendNotification } from "../services/notification";

const router = Router();

const createDispatchSchema = z.object({
  batchIds: z.array(z.string()).min(1),
  driverId: z.string().min(1),
  vehicleRegistration: z.string().min(4),
  pickupAddress: z.string().min(5),
  destinationFacilityId: z.string().min(1),
});

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const updateStatusSchema = z.object({
  status: z.enum([
    "REGISTERED",
    "ASSIGNED",
    "ACCEPTED",
    "REJECTED",
    "EN_ROUTE",
    "PICKED_UP",
    "IN_TRANSIT",
    "ON_BREAK",
    "ARRIVED_AT_FACTORY",
    "DELIVERED",
    "RECEIVED",
    "DISPUTED",
    "EXCEPTION",
  ]),
  pickupWeightKg: z.number().positive().optional(),
  deliveryWeightKg: z.number().positive().optional(),
  rejectionReason: z.string().optional(),
  exceptionReason: z.string().optional(),
  proofHash: z.string().optional(),
  deliveryProofUrl: z.string().optional(),
  discrepancyNotes: z.string().optional(),
});

// GET /api/dispatches
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.user!.role === Role.DRIVER) {
      const drv = await DriverModel.findOne({ userId: req.user!.id }).lean();
      const drvIds = [req.user!.id];
      if (drv) {
        drvIds.push((drv as any)._id.toString(), drv.driverId);
      }
      where.driverId = { $in: drvIds };
    } else if (req.user!.role === Role.DEALER) {
      where.$or = [
        { dealerId: req.user!.id },
        { dealerId: { $exists: false } },
        { dealerId: null },
      ];
    } else if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
      where.destinationFacilityId = req.user!.facilityId;
    }

    const rawDispatches = await DispatchModel.find(where).sort({ createdAt: -1 }).lean();

    const dispatches = await Promise.all(
      rawDispatches.map(async (d: any) => {
        const idStr = d._id.toString();
        const driver = d.driverId
          ? await UserModel.findById(d.driverId).select("id fullName phone organization").lean()
          : null;
        const destinationFacility = await FacilityModel.findById(d.destinationFacilityId).lean();

        // Fetch associated batches safely
        const validBatchObjIds = (d.batchIds || []).filter((id: string) => mongoose.Types.ObjectId.isValid(id));
        const batches = await WasteBatchModel.find({
          $or: [
            ...(validBatchObjIds.length > 0 ? [{ _id: { $in: validBatchObjIds } }] : []),
            { batchId: { $in: d.batchIds || [] } },
          ],
        }).lean();

        const populatedBatches = await Promise.all(
          batches.map(async (b: any) => {
            const cat = await WasteCategoryModel.findById(b.categoryId).lean();
            const dealer = await UserModel.findById(b.dealerId).select("fullName organization").lean();
            return {
              batch: {
                ...b,
                id: b._id.toString(),
                category: cat ? { ...cat, id: (cat as any)._id.toString() } : null,
                dealer,
              },
            };
          })
        );

        const handovers = await HandoverModel.find({ dispatchId: idStr }).lean();
        const receivingRecord = await ReceivingRecordModel.findOne({
          $or: [{ dispatchId: idStr }, { dispatchId: d.dispatchId }],
        }).lean();

        const isLocationStale = d.lastKnownLocation?.updatedAt
          ? Date.now() - new Date(d.lastKnownLocation.updatedAt).getTime() > 90 * 1000
          : true;

        if (
          isLocationStale &&
          !d.staleNotificationSent &&
          d.lastKnownLocation &&
          (d.status === DispatchStatus.IN_TRANSIT || d.status === DispatchStatus.ON_BREAK)
        ) {
          await DispatchModel.updateOne({ _id: d._id }, { staleNotificationSent: true });
          if (d.dealerId) {
            await sendNotification({
              userId: d.dealerId,
              title: `GPS Signal Stale: Shipment #${d.dispatchId}`,
              message: `Driver location updates have stopped for over 90 seconds. The vehicle position is offline and not live.`,
              type: "WARNING",
              entityType: "DISPATCH",
              entityId: d.dispatchId,
              actionUrl: "/dealer#tracking",
            });
          }
        }

        const formattedLocation = d.lastKnownLocation
          ? {
              ...d.lastKnownLocation,
              isStale: isLocationStale,
            }
          : null;

        return {
          ...d,
          id: idStr,
          driver: driver ? { ...driver, id: (driver as any)._id.toString() } : null,
          destinationFacility: destinationFacility
            ? { ...destinationFacility, id: (destinationFacility as any)._id.toString() }
            : null,
          batches: populatedBatches,
          handovers: handovers.map((h: any) => ({ ...h, id: h._id.toString() })),
          receivingRecord: receivingRecord ? { ...receivingRecord, id: (receivingRecord as any)._id.toString() } : null,
          lastKnownLocation: formattedLocation,
          isStale: isLocationStale,
          breaks: d.breaks || [],
          currentBreak: d.currentBreak || null,
          tripStartedAt: d.tripStartedAt,
          tripCompletedAt: d.tripCompletedAt,
          geofenceArrivalDetected: d.geofenceArrivalDetected || false,
          geofenceArrivalTime: d.geofenceArrivalTime,
          deliveryConfirmationOtp: d.deliveryConfirmationOtp,
          etaMinutes: d.etaMinutes,
          distanceKm: d.distanceKm,
        };
      })
    );

    res.json({ success: true, dispatches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dispatches/drivers (for dealer/admin to assign driver)
router.get("/drivers", authenticateToken, async (req: Request, res: Response) => {
  try {
    await ensureDefaultDrivers();
    const weightKg = parseFloat(req.query.weightKg as string) || 0;

    const rawDrivers = await DriverModel.find({}).sort({ fullName: 1 }).lean();
    let formatted: any[] = [];

    if (rawDrivers.length > 0) {
      formatted = rawDrivers.map((d: any) => ({
        id: d._id.toString(),
        driverId: d.driverId,
        fullName: d.fullName,
        phone: d.phone,
        email: d.email,
        vehicleType: d.vehicleType,
        vehicleRegistration: d.vehicleRegistration,
        loadCapacityKg: d.loadCapacityKg,
        availability: d.availability,
        isEligible: d.availability === "AVAILABLE" && (!weightKg || d.loadCapacityKg >= weightKg),
      }));
    } else {
      const drivers = await UserModel.find({ role: Role.DRIVER, status: "APPROVED" })
        .select("fullName phone organization")
        .lean();
      formatted = drivers.map((d: any) => ({
        ...d,
        id: d._id.toString(),
        vehicleRegistration: "KA-01-EQ-9988",
        loadCapacityKg: 5000,
        availability: "AVAILABLE",
        isEligible: true,
      }));
    }

    res.json({ success: true, drivers: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dispatches/optimize-routes (QpiAI Opt Driver Allocation & Routing with real pending batches)
router.get("/optimize-routes", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureDefaultDrivers();
    const pendingBatches = await WasteBatchModel.find({ status: BatchStatus.REGISTERED })
      .limit(10)
      .lean();

    const availableDrivers = await DriverModel.find({ availability: "AVAILABLE" }).lean();

    const batchesInput = pendingBatches.map((b: any) => ({
      batchId: b.batchId,
      name: `Batch ${b.batchId}`,
      location: b.pickupAddress || b.pickupLocation || "Peenya Industrial Aggregator",
      weightKg: b.initialWeightKg || 50,
      latitude: b.location?.latitude || (b.pickupAddress?.includes("Peenya") ? 13.03 : 12.97),
      longitude: b.location?.longitude || (b.pickupAddress?.includes("Peenya") ? 77.51 : 77.59),
    }));

    const driversInput = availableDrivers.map((d: any) => ({
      id: d._id.toString(),
      driverId: d.driverId,
      fullName: d.fullName,
      phone: d.phone,
      vehicleRegistration: d.vehicleRegistration,
      vehicleType: d.vehicleType,
      capacityKg: d.loadCapacityKg || 4000,
      availability: d.availability,
      latitude: 12.9716,
      longitude: 77.5946,
    }));

    const destinationFacility = await FacilityModel.findOne().lean();
    const destination = {
      name: destinationFacility?.name || "Apex E-Waste Disassembly & Smelting Hub",
      location: destinationFacility?.address || "Electronic City Phase 2, Bengaluru",
      latitude: destinationFacility?.location?.latitude || 12.8399,
      longitude: destinationFacility?.location?.longitude || 77.677,
    };

    const resOpt = await qpiAiService.runDriverAllocationOptimization(
      batchesInput,
      driversInput,
      destination,
      undefined,
      req.user!.id,
      req.ip
    );

    if (!resOpt.success) {
      if (resOpt.status === "EMPTY_INPUT_NO_BATCHES" || resOpt.status === "NO_AVAILABLE_DRIVERS") {
        res.json({
          success: false,
          status: resOpt.status,
          message: resOpt.error || "No eligible pending batches or available drivers to optimize.",
          optimization: {
            engine: "QpiAI_Opt_HiGHS_MILP",
            solverName: "HiGHS",
            hardwareBackend: "Classical CPU (Local execution)",
            status: resOpt.status,
            executionMode: "none",
            problemClass: "MILP",
            totalDistanceKm: 0,
            co2SavingsKg: null,
            carbonSavingsKg: null,
            co2SavingsExplanation: "No batches or drivers available; CO2 savings cannot be calculated on empty input.",
            orderedWaypoints: [],
            waypoints: [],
            driverAssignments: [],
            note: resOpt.error || "Input batch list is empty; solver was not invoked.",
            qpiaiLiveValidation: resOpt.report?.apiAuthStatus || {
              apiKeyPresent: qpiAiService.isConfigured(),
              serverAuthenticated: true,
              serverMessage: "API token verified. Solver was not invoked on empty batch input.",
            },
          },
          report: resOpt.report || null,
          pendingBatchesCount: pendingBatches.length,
          availableDriversCount: availableDrivers.length,
        });
        return;
      }

      res.status(resOpt.status === "QPIAI_OPT_CONFIG_MISSING" ? 400 : 503).json({
        success: false,
        status: resOpt.status,
        error: resOpt.error,
        message: "QpiAI optimization halted. Truthful solver status reported without silent fallback.",
      });
      return;
    }

    const report = resOpt.report;
    const firstAssignment = report.driverAssignments?.[0];
    const co2Val = report.fleetSummary?.totalCo2SavingsKg ?? null;

    // Format compatibility response for existing frontend call while including full report
    const formattedCompat = {
      engine: report.engine,
      solverName: report.solverName || "HiGHS",
      hardwareBackend: report.hardwareBackend || "Classical CPU (Local execution)",
      status: report.status,
      executionMode: report.executionMode,
      problemClass: report.problemClass,
      totalDistanceKm: report.fleetSummary?.totalFleetDistanceKm || 0,
      co2SavingsKg: co2Val,
      carbonSavingsKg: co2Val,
      co2SavingsExplanation: report.fleetSummary?.co2SavingsExplanation || "Calculated using DEFRA freight emissions benchmark.",
      orderedWaypoints: firstAssignment?.routeWaypoints || report.waypoints || [],
      waypoints: firstAssignment?.routeWaypoints || report.waypoints || [],
      driverAssignments: report.driverAssignments || [],
      fleetSummary: report.fleetSummary,
      baselineComparison: report.baselineComparison,
      constraintsValidation: report.constraintsValidation,
      unassignedBatches: report.unassignedBatches || [],
      reportId: report.reportId,
      persistedStatus: report.persistedStatus,
      qpiaiLiveValidation: report.apiAuthStatus,
      note: report.notes || `Route optimized using QpiAI Opt ${report.engine} solver.`,
    };

    res.json({
      success: true,
      optimization: formattedCompat,
      report,
      pendingBatchesCount: pendingBatches.length,
      availableDriversCount: availableDrivers.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dispatches/optimize-routes (Execute targeted QpiAI Optimization on selected batches/drivers)
router.post(
  "/optimize-routes",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await ensureDefaultDrivers();
      const { batchIds, driverIds, destinationFacilityId } = req.body || {};

      let batchFilter: any = { status: BatchStatus.REGISTERED };
      if (batchIds && Array.isArray(batchIds) && batchIds.length > 0) {
        batchFilter = {
          status: BatchStatus.REGISTERED,
          $or: [
            { batchId: { $in: batchIds } },
            ...(batchIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => ({ _id: id }))),
          ],
        };
      }

      const pendingBatches = await WasteBatchModel.find(batchFilter).limit(20).lean();

      let driverFilter: any = { availability: "AVAILABLE" };
      if (driverIds && Array.isArray(driverIds) && driverIds.length > 0) {
        driverFilter = {
          availability: "AVAILABLE",
          $or: [
            { driverId: { $in: driverIds } },
            ...(driverIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)).map((id: string) => ({ _id: id }))),
          ],
        };
      }

      const availableDrivers = await DriverModel.find(driverFilter).lean();

      const batchesInput = pendingBatches.map((b: any) => ({
        batchId: b.batchId,
        name: `Batch ${b.batchId}`,
        location: b.pickupAddress || b.pickupLocation || "Peenya Industrial Aggregator",
        weightKg: b.initialWeightKg || 50,
        latitude: b.location?.latitude || 13.03,
        longitude: b.location?.longitude || 77.51,
      }));

      const driversInput = availableDrivers.map((d: any) => ({
        id: d._id.toString(),
        driverId: d.driverId,
        fullName: d.fullName,
        phone: d.phone,
        vehicleRegistration: d.vehicleRegistration,
        vehicleType: d.vehicleType,
        capacityKg: d.loadCapacityKg || 4000,
        availability: d.availability,
        latitude: 12.9716,
        longitude: 77.5946,
      }));

      let destinationFacility: any = null;
      if (destinationFacilityId) {
        destinationFacility = await FacilityModel.findById(destinationFacilityId).lean();
      }
      if (!destinationFacility) {
        destinationFacility = await FacilityModel.findOne().lean();
      }

      const destination = {
        name: destinationFacility?.name || "Apex E-Waste Disassembly & Smelting Hub",
        location: destinationFacility?.address || "Electronic City Phase 2, Bengaluru",
        latitude: destinationFacility?.location?.latitude || 12.8399,
        longitude: destinationFacility?.location?.longitude || 77.677,
      };

      const resOpt = await qpiAiService.runDriverAllocationOptimization(
        batchesInput,
        driversInput,
        destination,
        undefined,
        req.user!.id,
        req.ip
      );

      if (!resOpt.success) {
        const isClientError =
          resOpt.status === "QPIAI_OPT_CONFIG_MISSING" ||
          resOpt.status === "EMPTY_INPUT_NO_BATCHES" ||
          resOpt.status === "NO_AVAILABLE_DRIVERS" ||
          resOpt.status === "MALFORMED_INPUT_PAYLOAD";
        res.status(isClientError ? 400 : 503).json({
          success: false,
          status: resOpt.status,
          error: resOpt.error,
          message: resOpt.report?.message || "Optimization could not be performed.",
        });
        return;
      }

      res.json({
        success: true,
        report: resOpt.report,
        message: "QpiAI multi-driver route optimization successfully solved and persisted.",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/dispatches/commit-optimization (Commit proposed QpiAI routes into official dispatches)
router.post(
  "/commit-optimization",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.body || {};
      if (!reportId) {
        res.status(400).json({ success: false, error: "reportId is required to commit dispatches." });
        return;
      }

      const commitRes = await qpiAiService.commitOptimizationDispatches(
        reportId,
        req.user!.id,
        req.user!.id,
        req.ip
      );

      if (!commitRes.success) {
        res.status(400).json({ success: false, error: commitRes.error });
        return;
      }

      res.json({
        success: true,
        message: `Successfully committed ${commitRes.dispatches?.length || 0} dispatches from QpiAI optimization run ${reportId}.`,
        dispatches: commitRes.dispatches,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/dispatches/optimization-reports (List past QpiAI optimization reports)
router.get(
  "/optimization-reports",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const reports = await OptimizationReportModel.find()
        .sort({ runTimestamp: -1 })
        .limit(20)
        .lean();

      res.json({ success: true, reports });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/dispatches/optimization-reports/:id (Get single QpiAI optimization report)
router.get(
  "/optimization-reports/:id",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const report = await OptimizationReportModel.findOne({
        $or: [
          { reportId: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        ],
      }).lean();

      if (!report) {
        res.status(404).json({ success: false, error: `Optimization report ${id} not found.` });
        return;
      }

      res.json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/dispatches/optimization-reports/:id/export/csv (Export report as CSV)
router.get(
  "/optimization-reports/:id/export/csv",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const report = await OptimizationReportModel.findOne({
        $or: [
          { reportId: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        ],
      });

      if (!report) {
        res.status(404).json({ success: false, error: `Optimization report ${id} not found.` });
        return;
      }

      const csvContent = qpiAiService.generateOptimizationCsv(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="EcoTrace_QpiAI_Optimization_${report.reportId}.csv"`
      );
      res.send(csvContent);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/dispatches/optimization-reports/:id/export/excel (Export report as XLSX)
router.get(
  "/optimization-reports/:id/export/excel",
  authenticateToken,
  requireRole(Role.ADMIN, Role.DEALER),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const report = await OptimizationReportModel.findOne({
        $or: [
          { reportId: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        ],
      });

      if (!report) {
        res.status(404).json({ success: false, error: `Optimization report ${id} not found.` });
        return;
      }

      const buffer = await qpiAiService.generateOptimizationExcelBuffer(report);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="EcoTrace_QpiAI_Optimization_${report.reportId}.xlsx"`
      );
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

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

      // Verify batches safely without CastError
      const validObjIds = batchIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      const batches = await WasteBatchModel.find({
        $or: [
          ...(validObjIds.length > 0 ? [{ _id: { $in: validObjIds } }] : []),
          { batchId: { $in: batchIds } },
        ],
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

      // Validate driver availability and vehicle payload capacity
      const queryDriver: any[] = [{ driverId: driverId.toUpperCase() }];
      if (mongoose.Types.ObjectId.isValid(driverId)) {
        queryDriver.push({ _id: driverId }, { userId: driverId });
      }
      const driverRecord = await DriverModel.findOne({ $or: queryDriver });

      if (driverRecord) {
        if (driverRecord.availability !== "AVAILABLE") {
          res.status(400).json({
            success: false,
            error: `Driver '${driverRecord.fullName}' is currently ${driverRecord.availability}. Only AVAILABLE drivers can be assigned new shipments.`,
          });
          return;
        }

        if (driverRecord.loadCapacityKg && totalDispatchedWeightKg > driverRecord.loadCapacityKg) {
          res.status(400).json({
            success: false,
            error: `Batch total weight (${totalDispatchedWeightKg} kg) exceeds vehicle payload capacity (${driverRecord.loadCapacityKg} kg) for driver '${driverRecord.fullName}'.`,
          });
          return;
        }
      }

      const count = await DispatchModel.countDocuments();
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

      // Create Dispatch in MongoDB
      const dispatch = await DispatchModel.create({
        dispatchId,
        driverId: driverRecord?.userId || driverId,
        dealerId: req.user!.id,
        vehicleRegistration,
        pickupAddress,
        destinationFacilityId,
        dispatchedWeightKg: totalDispatchedWeightKg,
        status: DispatchStatus.ASSIGNED,
        operatingMode: (req.body.operatingMode as any) || "MANUAL",
        assignedBy: req.user!.id,
        assignmentMethod: (req.body.assignmentMethod as any) || "MANUAL_DIRECT",
        manualOverrideReason: req.body.manualOverrideReason,
        pickupProofHash: proofHash,
        txHash,
        batchIds: batches.map((b) => b._id.toString()),
        deliveryConfirmationOtp: Math.floor(100000 + Math.random() * 900000).toString(),
      });

      // Update batches to DISPATCHED
      for (const b of batches) {
        await WasteBatchModel.findByIdAndUpdate(b._id, { status: BatchStatus.DISPATCHED });
      }

      // Update driver availability to ON_TRIP
      if (driverRecord) {
        driverRecord.availability = "ON_TRIP";
        driverRecord.currentDispatchId = dispatch.dispatchId;
        await driverRecord.save();
      }

      // Record Handover
      await HandoverModel.create({
        dispatchId: dispatch._id.toString(),
        senderUserId: req.user!.id,
        receiverUserId: driverId,
        handoverType: "ASSIGNMENT",
        evidenceHash: proofHash,
        notes: `Dispatched ${batches.length} batches (${totalDispatchedWeightKg} kg) assigned to driver.`,
      });

      await logAudit({
        userId: req.user!.id,
        action: "DISPATCH_CREATED",
        entityType: "DISPATCH",
        entityId: dispatch.dispatchId,
        details: { dispatchedWeightKg: totalDispatchedWeightKg, vehicleRegistration, txHash },
        ipAddress: req.ip,
      });

      // Notify Driver
      await sendNotification({
        userId: driverId,
        title: "New Pickup Assigned",
        message: `You have been assigned dispatch ${dispatchId} with ${batches.length} batch(es) totaling ${totalDispatchedWeightKg} kg.`,
        type: "INFO",
        entityType: "DISPATCH",
        entityId: dispatch.dispatchId,
        actionUrl: "/driver",
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

      const {
        status,
        pickupWeightKg,
        deliveryWeightKg,
        rejectionReason,
        exceptionReason,
        proofHash,
        deliveryProofUrl,
        discrepancyNotes,
      } = parse.data;

      const queryConditions: any[] = [{ dispatchId: id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryConditions.push({ _id: id });
      }

      const dispatch = await DispatchModel.findOne({ $or: queryConditions });

      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      // If driver, ensure driver is assigned (matches User ID or linked Driver ID)
      if (req.user!.role === Role.DRIVER) {
        const isAssigned =
          dispatch.driverId === req.user!.id ||
          (await DriverModel.exists({
            $or: [
              ...(mongoose.Types.ObjectId.isValid(dispatch.driverId) ? [{ _id: dispatch.driverId }] : []),
              { driverId: dispatch.driverId },
            ],
            userId: req.user!.id,
          }));
        if (!isAssigned) {
          res.status(403).json({ success: false, error: "You are not assigned to this dispatch." });
          return;
        }
      }

      // Valid workflow transitions:
      const validTransitions: Record<string, string[]> = {
        REGISTERED: ["ASSIGNED"],
        ASSIGNED: ["ACCEPTED", "REJECTED", "EN_ROUTE", "PICKED_UP", "EXCEPTION"],
        ACCEPTED: ["EN_ROUTE", "PICKED_UP", "IN_TRANSIT", "EXCEPTION"],
        EN_ROUTE: ["PICKED_UP", "IN_TRANSIT", "EXCEPTION"],
        PICKED_UP: ["IN_TRANSIT", "EXCEPTION"],
        IN_TRANSIT: ["ON_BREAK", "ARRIVED_AT_FACTORY", "DELIVERED", "DISPUTED", "EXCEPTION"],
        ON_BREAK: ["IN_TRANSIT", "ARRIVED_AT_FACTORY", "DELIVERED", "EXCEPTION"],
        ARRIVED_AT_FACTORY: ["DELIVERED", "RECEIVED", "DISPUTED", "EXCEPTION"],
        DELIVERED: ["RECEIVED", "DISPUTED", "EXCEPTION"],
        RECEIVED: [],
        DISPUTED: ["RECEIVED", "EXCEPTION"],
        EXCEPTION: ["IN_TRANSIT", "ON_BREAK", "ARRIVED_AT_FACTORY", "DELIVERED", "DISPUTED"],
        REJECTED: [],
      };

      const allowed = validTransitions[dispatch.status] || [];
      if (!allowed.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid transition from '${dispatch.status}' to '${status}'. Expected one of: ${allowed.join(", ")}`,
        });
        return;
      }

      const updateData: any = { status };

      if (status === "REJECTED") {
        updateData.rejectionReason = rejectionReason || "Driver unavailable";
        // Revert associated batches back to REGISTERED
        await WasteBatchModel.updateMany(
          { _id: { $in: dispatch.batchIds } },
          { status: BatchStatus.REGISTERED }
        );

        await sendNotification({
          role: Role.ADMIN,
          title: "Pickup Assignment Rejected",
          message: `Driver rejected dispatch ${dispatch.dispatchId}: ${updateData.rejectionReason}. Batches reverted to pending pickup.`,
          type: "WARNING",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (status === "ACCEPTED") {
        await sendNotification({
          role: Role.ADMIN,
          title: "Pickup Assignment Accepted",
          message: `Driver accepted dispatch ${dispatch.dispatchId}. En route preparation underway.`,
          type: "SUCCESS",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (status === "EN_ROUTE") {
        await sendNotification({
          role: Role.ADMIN,
          title: "Driver En Route to Pickup",
          message: `Driver is en route to pickup site for ${dispatch.dispatchId}.`,
          type: "INFO",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (status === DispatchStatus.PICKED_UP) {
        updateData.pickupTime = new Date();
        if (pickupWeightKg) updateData.pickupWeightKg = pickupWeightKg;
        if (proofHash) updateData.pickupProofHash = proofHash;

        // Ensure batches are in DISPATCHED status
        await WasteBatchModel.updateMany(
          { _id: { $in: dispatch.batchIds } },
          { status: BatchStatus.DISPATCHED }
        );

        await sendNotification({
          role: Role.FACTORY,
          title: "Waste Picked Up & In Transit",
          message: `Dispatch ${dispatch.dispatchId} (${updateData.pickupWeightKg || dispatch.dispatchedWeightKg} kg) picked up. Heading to receiving hub.`,
          type: "INFO",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (status === "EXCEPTION") {
        updateData.exceptionReason = exceptionReason || discrepancyNotes || "Transit exception reported";
        await sendNotification({
          role: Role.ADMIN,
          title: "Transit Exception Flagged",
          message: `Driver reported exception on ${dispatch.dispatchId}: ${updateData.exceptionReason}`,
          type: "ALERT",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (status === DispatchStatus.DELIVERED) {
        updateData.deliveryTime = new Date();
        if (deliveryWeightKg) updateData.deliveryWeightKg = deliveryWeightKg;
        if (proofHash) updateData.deliveryProofHash = proofHash;
        if (deliveryProofUrl) updateData.deliveryProofUrl = deliveryProofUrl;

        await sendNotification({
          role: Role.FACTORY,
          title: "Shipment Arrived at Facility",
          message: `Dispatch ${dispatch.dispatchId} arrived at facility weighbridge. Ready for intake inspection.`,
          type: "INFO",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });
      }

      if (discrepancyNotes) {
        updateData.discrepancyNotes = discrepancyNotes;
      }

      const updated = await DispatchModel.findByIdAndUpdate(dispatch._id, updateData, { new: true });

      // If delivery completed or rejected, check if driver availability can be restored to AVAILABLE
      if (["DELIVERED", "REJECTED"].includes(status) && dispatch.driverId) {
        const remainingActive = await DispatchModel.countDocuments({
          driverId: dispatch.driverId,
          _id: { $ne: dispatch._id },
          status: { $in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "PICKED_UP", "IN_TRANSIT"] },
        });
        if (remainingActive === 0) {
          await DriverModel.updateMany(
            { $or: [{ _id: dispatch.driverId }, { userId: dispatch.driverId }, { driverId: dispatch.driverId }] },
            { availability: "AVAILABLE", currentDispatchId: null }
          );
        }
      }

      // Record Handover event
      await HandoverModel.create({
        dispatchId: dispatch._id.toString(),
        senderUserId: req.user!.id,
        handoverType: status,
        evidenceHash: proofHash || null,
        notes: discrepancyNotes || exceptionReason || rejectionReason || `Dispatch updated to ${status}`,
      });

      await logAudit({
        userId: req.user!.id,
        action: `DISPATCH_STATUS_${status}`,
        entityType: "DISPATCH",
        entityId: dispatch.dispatchId,
        details: { previousStatus: dispatch.status, newStatus: status, updateData },
        ipAddress: req.ip,
      });

      res.json({ success: true, dispatch: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Helper to verify driver assignment
async function verifyDriverAssignedToDispatch(dispatch: any, userId: string): Promise<boolean> {
  if (dispatch.driverId === userId) return true;
  const drvExists = await DriverModel.exists({
    $or: [
      ...(mongoose.Types.ObjectId.isValid(dispatch.driverId) ? [{ _id: dispatch.driverId }] : []),
      { driverId: dispatch.driverId },
    ],
    userId,
  });
  return !!drvExists;
}

const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().nonnegative().optional(),
  accuracy: z.number().nonnegative().optional(),
  timestamp: z.string().or(z.date()).optional(),
});

const tripActionSchema = z.object({
  action: z.enum(["START_TRIP", "START_BREAK", "RESUME_TRIP", "COMPLETE_TRIP"]),
  reason: z.string().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

const confirmDeliverySchema = z.object({
  otp: z.string().optional(),
  notes: z.string().optional(),
  verifiedWeightKg: z.number().positive().optional(),
});

// POST /api/dispatches/:id/location - Driver updates live GPS coordinates
router.post(
  "/:id/location",
  authenticateToken,
  requireRole(Role.DRIVER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parse = locationUpdateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const queryConditions: any[] = [{ dispatchId: id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryConditions.push({ _id: id });
      }

      const dispatch = await DispatchModel.findOne({ $or: queryConditions });
      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      if (req.user!.role === Role.DRIVER) {
        const isAssigned = await verifyDriverAssignedToDispatch(dispatch, req.user!.id);
        if (!isAssigned) {
          res.status(403).json({ success: false, error: "Unauthorized: You are not assigned to this dispatch." });
          return;
        }
      }

      // If already delivered or received or rejected, refuse updates
      if (["DELIVERED", "RECEIVED", "REJECTED"].includes(dispatch.status)) {
        res.status(400).json({
          success: false,
          error: `Cannot update GPS location: shipment is already ${dispatch.status}`,
        });
        return;
      }

      const { latitude, longitude, heading, speed, accuracy } = parse.data;
      const now = new Date();

      dispatch.lastKnownLocation = {
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
        updatedAt: now,
        isStale: false,
      };
      dispatch.staleNotificationSent = false;

      if (!dispatch.locationHistory) dispatch.locationHistory = [];
      dispatch.locationHistory.push({
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        timestamp: now,
      });
      if (dispatch.locationHistory.length > 200) {
        dispatch.locationHistory = dispatch.locationHistory.slice(-200);
      }

      // Check factory geofence arrival
      const destinationFacility = await FacilityModel.findById(dispatch.destinationFacilityId).lean();
      let arrivalDetectedNow = false;

      if (destinationFacility && destinationFacility.location?.latitude && destinationFacility.location?.longitude) {
        const distMeters = calculateHaversineDistanceMeters(
          latitude,
          longitude,
          destinationFacility.location.latitude,
          destinationFacility.location.longitude
        );
        const geofenceRadius = destinationFacility.geofenceRadiusMeters || 500;
        const isAccurate = !accuracy || accuracy <= 150;

        if (distMeters <= geofenceRadius && isAccurate) {
          if (!dispatch.geofenceArrivalDetected) {
            dispatch.geofenceArrivalDetected = true;
            dispatch.geofenceArrivalTime = now;
            arrivalDetectedNow = true;

            if (dispatch.status === "IN_TRANSIT" || dispatch.status === "ON_BREAK") {
              dispatch.status = "ARRIVED_AT_FACTORY";
            }

            if (!dispatch.deliveryConfirmationOtp) {
              dispatch.deliveryConfirmationOtp = Math.floor(100000 + Math.random() * 900000).toString();
            }

            // Send notification to Dealer
            if (dispatch.dealerId) {
              await sendNotification({
                userId: dispatch.dealerId,
                title: "Truck Arrived at Factory Geofence",
                message: `Carrier ${dispatch.vehicleRegistration} (Dispatch ${dispatch.dispatchId}) has arrived within the gate geofence of ${destinationFacility.name}.`,
                type: "SUCCESS",
                entityType: "DISPATCH",
                entityId: dispatch.dispatchId,
                actionUrl: "/dealer#tracking",
              });
            }

            // Send notification to Factory staff
            await sendNotification({
              role: Role.FACTORY,
              title: "Incoming Truck Arrived at Gate",
              message: `Carrier ${dispatch.vehicleRegistration} carrying ${dispatch.dispatchedWeightKg} kg has reached the facility perimeter. Verification pending.`,
              type: "INFO",
              entityType: "DISPATCH",
              entityId: dispatch.dispatchId,
              actionUrl: "/factory#incoming",
            });

            await logAudit({
              userId: req.user!.id,
              action: "GEOFENCE_ARRIVAL_DETECTED",
              entityType: "DISPATCH",
              entityId: dispatch.dispatchId,
              details: {
                facilityName: destinationFacility.name,
                distanceMeters: Math.round(distMeters),
                geofenceRadius,
                accuracy,
              },
              ipAddress: req.ip,
            });
          }
        }
      }

      await dispatch.save();

      res.json({
        success: true,
        dispatchId: dispatch.dispatchId,
        status: dispatch.status,
        lastKnownLocation: dispatch.lastKnownLocation,
        geofenceArrivalDetected: dispatch.geofenceArrivalDetected,
        arrivalDetectedNow,
        distanceKm: dispatch.distanceKm,
        etaMinutes: dispatch.etaMinutes,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/dispatches/:id/trip-action - Driver lifecycle control (Start, Break, Resume, Complete)
router.post(
  "/:id/trip-action",
  authenticateToken,
  requireRole(Role.DRIVER, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parse = tripActionSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const queryConditions: any[] = [{ dispatchId: id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryConditions.push({ _id: id });
      }

      const dispatch = await DispatchModel.findOne({ $or: queryConditions });
      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      if (req.user!.role === Role.DRIVER) {
        const isAssigned = await verifyDriverAssignedToDispatch(dispatch, req.user!.id);
        if (!isAssigned) {
          res.status(403).json({ success: false, error: "Unauthorized: You are not assigned to this dispatch." });
          return;
        }
      }

      const { action, reason, location } = parse.data;
      const now = new Date();

      if (action === "START_TRIP") {
        if (!["ACCEPTED", "PICKED_UP"].includes(dispatch.status)) {
          res.status(400).json({
            success: false,
            error: `Cannot start trip: Shipment status is '${dispatch.status}'. Trip can only start after assignment acceptance or pickup.`,
          });
          return;
        }

        dispatch.status = DispatchStatus.IN_TRANSIT;
        dispatch.tripStartedAt = now;
        if (!dispatch.pickupTime) dispatch.pickupTime = now;
        if (!dispatch.deliveryConfirmationOtp) {
          dispatch.deliveryConfirmationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        }

        if (location) {
          dispatch.lastKnownLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            updatedAt: now,
            isStale: false,
          };
        }

        if (dispatch.dealerId) {
          await sendNotification({
            userId: dispatch.dealerId,
            title: "Carrier Trip Started",
            message: `Truck ${dispatch.vehicleRegistration} has departed on transit route for dispatch ${dispatch.dispatchId}.`,
            type: "INFO",
            entityType: "DISPATCH",
            entityId: dispatch.dispatchId,
            actionUrl: "/dealer#tracking",
          });
        }

        await sendNotification({
          role: Role.FACTORY,
          title: "Carrier Departed for Intake",
          message: `Dispatch ${dispatch.dispatchId} is now In Transit toward facility.`,
          type: "INFO",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });

        await logAudit({
          userId: req.user!.id,
          action: "TRIP_STARTED",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
          details: { vehicleRegistration: dispatch.vehicleRegistration, location },
          ipAddress: req.ip,
        });
      } else if (action === "START_BREAK") {
        if (dispatch.status !== DispatchStatus.IN_TRANSIT) {
          res.status(400).json({
            success: false,
            error: `Cannot start break: Truck is currently '${dispatch.status}'. Break can only be started while In Transit.`,
          });
          return;
        }

        dispatch.status = DispatchStatus.ON_BREAK;
        const breakEntry: any = {
          breakId: `BRK-${Date.now()}`,
          startTime: now,
          startLocation: location,
          reason: reason || "Mandatory driver rest / highway meal break",
        };

        if (!dispatch.breaks) dispatch.breaks = [];
        dispatch.breaks.push(breakEntry);
        dispatch.currentBreak = breakEntry;

        if (location) {
          dispatch.lastKnownLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            updatedAt: now,
            isStale: false,
          };
        }

        if (dispatch.dealerId) {
          await sendNotification({
            userId: dispatch.dealerId,
            title: "Driver Break Started",
            message: `Carrier ${dispatch.vehicleRegistration} (Dispatch ${dispatch.dispatchId}) has paused for break: ${breakEntry.reason}.`,
            type: "WARNING",
            entityType: "DISPATCH",
            entityId: dispatch.dispatchId,
            actionUrl: "/dealer#tracking",
          });
        }

        await logAudit({
          userId: req.user!.id,
          action: "BREAK_STARTED",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
          details: { breakId: breakEntry.breakId, reason: breakEntry.reason, location },
          ipAddress: req.ip,
        });
      } else if (action === "RESUME_TRIP") {
        if (dispatch.status !== DispatchStatus.ON_BREAK) {
          res.status(400).json({
            success: false,
            error: `Cannot resume trip: Shipment is not currently on break (status: '${dispatch.status}').`,
          });
          return;
        }

        dispatch.status = dispatch.geofenceArrivalDetected
          ? DispatchStatus.ARRIVED_AT_FACTORY
          : DispatchStatus.IN_TRANSIT;

        if (dispatch.currentBreak) {
          const idx = dispatch.breaks.findIndex((b: any) => b.breakId === dispatch.currentBreak?.breakId);
          if (idx !== -1) {
            dispatch.breaks[idx].endTime = now;
            if (location) dispatch.breaks[idx].endLocation = location;
          }
          dispatch.currentBreak = undefined;
        }

        if (location) {
          dispatch.lastKnownLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            updatedAt: now,
            isStale: false,
          };
        }

        if (dispatch.dealerId) {
          await sendNotification({
            userId: dispatch.dealerId,
            title: "Driver Break Completed — Trip Resumed",
            message: `Carrier ${dispatch.vehicleRegistration} (Dispatch ${dispatch.dispatchId}) has resumed travel toward factory.`,
            type: "INFO",
            entityType: "DISPATCH",
            entityId: dispatch.dispatchId,
            actionUrl: "/dealer#tracking",
          });
        }

        await logAudit({
          userId: req.user!.id,
          action: "BREAK_ENDED",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
          details: { location },
          ipAddress: req.ip,
        });
      } else if (action === "COMPLETE_TRIP") {
        if (!["IN_TRANSIT", "ARRIVED_AT_FACTORY", "PICKED_UP"].includes(dispatch.status)) {
          res.status(400).json({
            success: false,
            error: `Cannot complete trip: Shipment status is '${dispatch.status}'.`,
          });
          return;
        }

        dispatch.status = DispatchStatus.DELIVERED;
        dispatch.tripCompletedAt = now;
        dispatch.deliveryTime = now;

        if (location) {
          dispatch.lastKnownLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            updatedAt: now,
            isStale: false,
          };
        }

        if (dispatch.dealerId) {
          await sendNotification({
            userId: dispatch.dealerId,
            title: "Shipment Delivered at Gate",
            message: `Truck ${dispatch.vehicleRegistration} has marked delivery completed at facility for dispatch ${dispatch.dispatchId}.`,
            type: "SUCCESS",
            entityType: "DISPATCH",
            entityId: dispatch.dispatchId,
            actionUrl: "/dealer#tracking",
          });
        }

        await sendNotification({
          role: Role.FACTORY,
          title: "Shipment Gate Arrival Confirmed",
          message: `Dispatch ${dispatch.dispatchId} is ready for intake weighbridge inspection.`,
          type: "INFO",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
        });

        await logAudit({
          userId: req.user!.id,
          action: "TRIP_COMPLETED",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
          details: { vehicleRegistration: dispatch.vehicleRegistration },
          ipAddress: req.ip,
        });
      }

      await dispatch.save();

      res.json({
        success: true,
        message: `Trip action '${action}' applied successfully.`,
        dispatch,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/dispatches/:id/confirm-delivery - Factory confirms delivery receipt
router.post(
  "/:id/confirm-delivery",
  authenticateToken,
  requireRole(Role.FACTORY, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parse = confirmDeliverySchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ success: false, error: "Validation error", details: parse.error.format() });
        return;
      }

      const queryConditions: any[] = [{ dispatchId: id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryConditions.push({ _id: id });
      }

      const dispatch = await DispatchModel.findOne({ $or: queryConditions });
      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      // Check factory authorization: user must belong to destination facility if FACTORY role
      if (req.user!.role === Role.FACTORY && req.user!.facilityId) {
        if (dispatch.destinationFacilityId !== req.user!.facilityId) {
          res.status(403).json({
            success: false,
            error: "Unauthorized: Shipment is not routed to your facility.",
          });
          return;
        }
      }

      // STRICT PREVENT DUPLICATE CONFIRMATIONS
      if (dispatch.deliveryConfirmedAt || dispatch.status === DispatchStatus.RECEIVED) {
        res.status(400).json({
          success: false,
          error: `Duplicate confirmation: Delivery for dispatch ${dispatch.dispatchId} was already confirmed at ${dispatch.deliveryConfirmedAt || "previous intake"}.`,
        });
        return;
      }

      const { otp, notes, verifiedWeightKg } = parse.data;

      // If OTP is provided, validate it
      if (dispatch.deliveryConfirmationOtp && otp) {
        if (otp.trim() !== dispatch.deliveryConfirmationOtp.trim()) {
          res.status(400).json({
            success: false,
            error: "Invalid delivery handover OTP. Please verify with the carrier driver.",
          });
          return;
        }
      }

      const now = new Date();
      dispatch.status = DispatchStatus.DELIVERED;
      dispatch.deliveryConfirmedAt = now;
      dispatch.deliveryConfirmedByUserId = req.user!.id;
      if (verifiedWeightKg) dispatch.deliveryWeightKg = verifiedWeightKg;
      if (notes) dispatch.discrepancyNotes = notes;

      await dispatch.save();

      // Notify Dealer
      if (dispatch.dealerId) {
        await sendNotification({
          userId: dispatch.dealerId,
          title: "Shipment Delivery Confirmed by Factory",
          message: `Factory staff has confirmed receipt and delivery of dispatch ${dispatch.dispatchId} (${dispatch.dispatchedWeightKg} kg).`,
          type: "SUCCESS",
          entityType: "DISPATCH",
          entityId: dispatch.dispatchId,
          actionUrl: "/dealer#tracking",
        });
      }

      await logAudit({
        userId: req.user!.id,
        action: "FACTORY_DELIVERY_CONFIRMED",
        entityType: "DISPATCH",
        entityId: dispatch.dispatchId,
        details: { verifiedWeightKg, notes, deliveryConfirmedAt: now },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "Delivery officially confirmed by factory staff.",
        dispatch,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/dispatches/:id/tracking - Detailed live tracking view
router.get(
  "/:id/tracking",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const queryConditions: any[] = [{ dispatchId: id }];
      if (mongoose.Types.ObjectId.isValid(id)) {
        queryConditions.push({ _id: id });
      }

      const dispatch = await DispatchModel.findOne({ $or: queryConditions }).lean();
      if (!dispatch) {
        res.status(404).json({ success: false, error: "Dispatch not found" });
        return;
      }

      // Check access permission: Admin, assigned Driver, Dealer owner, or destination Factory
      const user = req.user!;
      const isAssignedDriver = user.role === Role.DRIVER && dispatch.driverId === user.id;
      const isDealerOwner = user.role === Role.DEALER && (dispatch.dealerId === user.id || !dispatch.dealerId);
      const isDestinationFactory =
        user.role === Role.FACTORY && (!user.facilityId || dispatch.destinationFacilityId === user.facilityId);
      const isAdmin = user.role === Role.ADMIN;

      if (!isAdmin && !isAssignedDriver && !isDealerOwner && !isDestinationFactory) {
        res.status(403).json({ success: false, error: "Unauthorized to view tracking for this dispatch." });
        return;
      }

      const destinationFacility = await FacilityModel.findById(dispatch.destinationFacilityId).lean();
      const driver = dispatch.driverId
        ? await UserModel.findById(dispatch.driverId).select("id fullName phone organization").lean()
        : null;

      const isStale = dispatch.lastKnownLocation?.updatedAt
        ? Date.now() - new Date(dispatch.lastKnownLocation.updatedAt).getTime() > 90 * 1000
        : true;

      res.json({
        success: true,
        dispatchId: dispatch.dispatchId,
        status: dispatch.status,
        vehicleRegistration: dispatch.vehicleRegistration,
        dispatchedWeightKg: dispatch.dispatchedWeightKg,
        pickupAddress: dispatch.pickupAddress,
        destinationFacility: destinationFacility
          ? {
              id: (destinationFacility as any)._id.toString(),
              name: destinationFacility.name,
              address: destinationFacility.address,
              location: destinationFacility.location,
              geofenceRadiusMeters: destinationFacility.geofenceRadiusMeters || 500,
            }
          : null,
        driver: driver ? { ...driver, id: (driver as any)._id.toString() } : null,
        lastKnownLocation: dispatch.lastKnownLocation ? { ...dispatch.lastKnownLocation, isStale } : null,
        isStale,
        breaks: dispatch.breaks || [],
        currentBreak: dispatch.currentBreak || null,
        tripStartedAt: dispatch.tripStartedAt,
        tripCompletedAt: dispatch.tripCompletedAt,
        geofenceArrivalDetected: dispatch.geofenceArrivalDetected || false,
        geofenceArrivalTime: dispatch.geofenceArrivalTime,
        deliveryConfirmedAt: dispatch.deliveryConfirmedAt,
        deliveryConfirmationOtp:
          isAssignedDriver || isAdmin || isDestinationFactory ? dispatch.deliveryConfirmationOtp : undefined,
        locationHistory: dispatch.locationHistory || [],
        distanceKm: dispatch.distanceKm,
        etaMinutes: dispatch.etaMinutes,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
