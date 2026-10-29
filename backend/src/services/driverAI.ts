import mongoose from "mongoose";
import {
  DriverModel,
  IDriver,
  DriverAvailability,
  DispatchModel,
  IDispatch,
  PickupTaskModel,
  WasteBatchModel,
  DriverOperatingModeModel,
  OperatingModeType,
  Role,
} from "../models";
import { qpiAiService, BatchOptimizationInput, DriverOptimizationInput } from "./qpiai";
import { logAudit } from "./audit";

export interface DriverRecommendation {
  driverId: string;
  id: string;
  fullName: string;
  email: string;
  phone: string;
  vehicleRegistration: string;
  vehicleType: string;
  loadCapacityKg: number;
  availability: DriverAvailability;
  suitabilityScore: number; // 0 - 100
  capacityUtilizationPercent: number;
  isCapacitySufficient: boolean;
  proximityKm?: number;
  matchReasons: string[];
  warnings?: string[];
}

export interface ManualAssignmentInput {
  dispatchId?: string;
  pickupTaskId?: string;
  driverId: string;
  assignedByUserId: string;
  assignedByRole: string;
  assignedByName?: string;
  overrideReason?: string;
  vehicleRegistration?: string;
  vehicleType?: string;
}

export class DriverAIService {
  /**
   * Retrieves the current system operating mode (AI or MANUAL).
   * Default is MANUAL mode if not previously configured.
   */
  async getOperatingMode(scope: string = "GLOBAL"): Promise<{
    mode: OperatingModeType;
    updatedBy?: string;
    updatedByName?: string;
    updatedByRole?: string;
    updatedAt?: Date;
    notes?: string;
  }> {
    const record = await DriverOperatingModeModel.findOne({ scope }).lean();
    if (record) {
      return {
        mode: record.mode as OperatingModeType,
        updatedBy: record.updatedBy,
        updatedByName: record.updatedByName,
        updatedByRole: record.updatedByRole,
        updatedAt: record.updatedAt,
        notes: record.notes,
      };
    }
    return {
      mode: "MANUAL",
      notes: "Default operating mode is Manual Mode",
    };
  }

  /**
   * Toggles or sets the operating mode (AI vs MANUAL).
   * Persisted in the database to survive server restarts and page refreshes.
   */
  async setOperatingMode(
    mode: OperatingModeType,
    userId: string,
    userRole: string,
    userName?: string,
    notes?: string,
    scope: string = "GLOBAL"
  ): Promise<{ success: boolean; mode: OperatingModeType; message: string }> {
    const updated = await DriverOperatingModeModel.findOneAndUpdate(
      { scope },
      {
        $set: {
          mode,
          updatedBy: userId,
          updatedByName: userName || "Authorized Operator",
          updatedByRole: userRole,
          notes: notes || `Mode set to ${mode} by ${userRole}`,
        },
      },
      { upsert: true, new: true }
    );

    await logAudit({
      userId,
      action: "UPDATE_OPERATING_MODE",
      entityType: "DriverOperatingMode",
      entityId: scope,
      details: {
        mode,
        role: userRole,
        description: `Driver allocation mode switched to ${mode}. Notes: ${notes || "None"}`,
      },
    });

    return {
      success: true,
      mode: updated.mode,
      message: `Driver operating mode successfully switched to ${mode}.`,
    };
  }

  /**
   * Retrieves drivers from the real database, accurately checking active dispatch
   * or pickup trip engagements to prevent false "AVAILABLE" reporting.
   */
  async getRealDriversWithActiveStatus(): Promise<Array<IDriver & { activeDispatchCount: number; activePickupCount: number }>> {
    const drivers = await DriverModel.find().sort({ fullName: 1 }).lean();

    const enriched = await Promise.all(
      drivers.map(async (driver: any) => {
        // Query active dispatches for this driver
        const activeDispatches = await DispatchModel.countDocuments({
          $or: [{ driverId: driver.userId }, { driverId: driver.driverId }, { driverId: driver._id.toString() }],
          status: {
            $in: [
              "REGISTERED",
              "ASSIGNED",
              "ACCEPTED",
              "EN_ROUTE",
              "PICKED_UP",
              "IN_TRANSIT",
              "ON_BREAK",
              "ARRIVED_AT_FACTORY",
            ],
          },
        });

        // Query active pickup tasks
        const activePickups = await PickupTaskModel.countDocuments({
          $or: [{ driverId: driver.userId }, { driverId: driver.driverId }, { driverId: driver._id.toString() }],
          status: { $in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED"] },
        });

        // Determine effective availability
        let effectiveAvailability: DriverAvailability = driver.availability;
        if (activeDispatches > 0 || activePickups > 0) {
          effectiveAvailability = "ON_TRIP";
        }

        return {
          ...driver,
          id: driver._id.toString(),
          availability: effectiveAvailability,
          activeDispatchCount: activeDispatches,
          activePickupCount: activePickups,
        };
      })
    );

    return enriched;
  }

  /**
   * Generates AI driver assignment recommendations based on payload weight,
   * vehicle load capacity, availability, and active assignments.
   */
  async getDriverRecommendations(params: {
    requiredWeightKg?: number;
    pickupLocation?: string;
    preferredVehicleType?: string;
  }): Promise<{
    success: boolean;
    recommendations: DriverRecommendation[];
    availableCount: number;
    totalDrivers: number;
    operatingMode: OperatingModeType;
  }> {
    const currentModeInfo = await this.getOperatingMode();
    const allDrivers = await this.getRealDriversWithActiveStatus();
    const requiredWeight = Math.max(0, params.requiredWeightKg || 0);

    const recommendations: DriverRecommendation[] = [];

    for (const d of allDrivers) {
      const matchReasons: string[] = [];
      const warnings: string[] = [];
      let score = 50; // base score

      const isAvailable = d.availability === "AVAILABLE" && d.activeDispatchCount === 0 && d.activePickupCount === 0;

      if (!isAvailable) {
        if (d.availability === "ON_TRIP" || d.activeDispatchCount > 0 || d.activePickupCount > 0) {
          warnings.push("Driver is currently on an active trip");
          score -= 40;
        } else if (d.availability === "MAINTENANCE") {
          warnings.push("Vehicle is currently under maintenance");
          score -= 50;
        } else if (d.availability === "OFF_DUTY") {
          warnings.push("Driver is currently off duty");
          score -= 45;
        }
      } else {
        matchReasons.push("Driver is currently Available and ready for dispatch");
        score += 20;
      }

      // Capacity analysis
      const capacity = d.loadCapacityKg || 1000;
      const isCapacitySufficient = capacity >= requiredWeight;
      const utilization = requiredWeight > 0 ? Math.min(100, Math.round((requiredWeight / capacity) * 100)) : 0;

      if (requiredWeight > 0) {
        if (isCapacitySufficient) {
          matchReasons.push(`Capacity matches payload (${requiredWeight} kg <= ${capacity} kg capacity)`);
          score += 20;

          // Ideal utilization bonus (between 40% and 95% is optimal)
          if (utilization >= 40 && utilization <= 95) {
            matchReasons.push(`Optimal payload utilization (${utilization}%)`);
            score += 10;
          } else if (utilization < 40) {
            matchReasons.push(`Oversized vehicle for payload (${utilization}% utilization)`);
          }
        } else {
          warnings.push(`Insufficient capacity: requires ${requiredWeight} kg, vehicle max is ${capacity} kg`);
          score -= 30;
        }
      }

      // Vehicle preference match
      if (params.preferredVehicleType && params.preferredVehicleType !== "ALL") {
        if (d.vehicleType.toLowerCase().includes(params.preferredVehicleType.toLowerCase())) {
          matchReasons.push(`Vehicle type matches requested preference (${d.vehicleType})`);
          score += 10;
        }
      }

      const clampedScore = Math.max(0, Math.min(100, score));

      recommendations.push({
        driverId: d.driverId,
        id: d.id,
        fullName: d.fullName,
        email: d.email,
        phone: d.phone,
        vehicleRegistration: d.vehicleRegistration,
        vehicleType: d.vehicleType,
        loadCapacityKg: capacity,
        availability: d.availability,
        suitabilityScore: clampedScore,
        capacityUtilizationPercent: utilization,
        isCapacitySufficient,
        matchReasons,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    }

    // Sort by suitability score descending
    recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    const availableCount = recommendations.filter((r) => r.availability === "AVAILABLE").length;

    return {
      success: true,
      recommendations,
      availableCount,
      totalDrivers: allDrivers.length,
      operatingMode: currentModeInfo.mode,
    };
  }

  /**
   * Manually assigns or reassigns a driver to a dispatch batch or pickup task.
   * Completely independent of AI — runs 100% reliably without requiring QpiAI.
   * Validates availability, prevents duplicate simultaneous assignments, updates database,
   * and prevents automated AI overwriting.
   */
  async manualAssignDriver(input: ManualAssignmentInput): Promise<{
    success: boolean;
    message: string;
    dispatch?: any;
    pickupTask?: any;
  }> {
    const { dispatchId, pickupTaskId, driverId, assignedByUserId, assignedByRole, assignedByName, overrideReason } = input;

    if (!dispatchId && !pickupTaskId) {
      throw new Error("Either dispatchId or pickupTaskId must be provided for driver assignment.");
    }

    // 1. Find Driver in Database
    const isObjectId = mongoose.Types.ObjectId.isValid(driverId);
    const driver = await DriverModel.findOne({
      $or: [{ driverId }, ...(isObjectId ? [{ _id: driverId }] : []), { userId: driverId }],
    });

    if (!driver) {
      throw new Error(`Driver with ID "${driverId}" was not found in the database.`);
    }

    // 2. Strict Driver Status Validation
    if (driver.availability === "OFF_DUTY") {
      throw new Error(`Cannot assign driver ${driver.fullName}: Driver is currently OFF_DUTY.`);
    }
    if (driver.availability === "MAINTENANCE") {
      throw new Error(`Cannot assign driver ${driver.fullName}: Vehicle (${driver.vehicleRegistration}) is in MAINTENANCE.`);
    }

    // 3. Prevent Duplicate Active Assignments
    const activeDispatches = await DispatchModel.find({
      $or: [{ driverId: driver.userId }, { driverId: driver.driverId }, { driverId: driver._id.toString() }],
      ...(dispatchId ? { dispatchId: { $ne: dispatchId } } : {}),
      status: {
        $in: [
          "REGISTERED",
          "ASSIGNED",
          "ACCEPTED",
          "EN_ROUTE",
          "PICKED_UP",
          "IN_TRANSIT",
          "ON_BREAK",
          "ARRIVED_AT_FACTORY",
        ],
      },
    });

    const activePickups = await PickupTaskModel.find({
      $or: [{ driverId: driver.userId }, { driverId: driver.driverId }, { driverId: driver._id.toString() }],
      ...(pickupTaskId ? { taskId: { $ne: pickupTaskId } } : {}),
      status: { $in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED"] },
    });

    if (activeDispatches.length > 0 || activePickups.length > 0) {
      const activeRef = activeDispatches[0]?.dispatchId || activePickups[0]?.taskId;
      throw new Error(
        `Conflict: Driver ${driver.fullName} is already assigned to active trip "${activeRef}". Simultaneous duplicate trips are prevented.`
      );
    }

    let updatedDispatch: any = null;
    let updatedPickup: any = null;

    // 4. Handle Dispatch Assignment
    if (dispatchId) {
      const dispatch = await DispatchModel.findOne({
        $or: [{ dispatchId }, ...(mongoose.Types.ObjectId.isValid(dispatchId) ? [{ _id: dispatchId }] : [])],
      });

      if (!dispatch) {
        throw new Error(`Dispatch with ID "${dispatchId}" not found.`);
      }

      // Check capacity
      if (dispatch.dispatchedWeightKg > driver.loadCapacityKg) {
        throw new Error(
          `Payload capacity exceeded: Dispatch requires ${dispatch.dispatchedWeightKg} kg, but ${driver.fullName}'s vehicle capacity is ${driver.loadCapacityKg} kg.`
        );
      }

      dispatch.driverId = driver.userId || driver.driverId;
      dispatch.vehicleRegistration = input.vehicleRegistration || driver.vehicleRegistration;
      dispatch.status = dispatch.status === "REGISTERED" ? "ASSIGNED" : dispatch.status;
      dispatch.operatingMode = "MANUAL";
      dispatch.assignedBy = assignedByUserId;
      dispatch.assignmentMethod = overrideReason ? "MANUAL_OVERRIDE" : "MANUAL_DIRECT";
      if (overrideReason) {
        dispatch.manualOverrideReason = overrideReason;
      }

      updatedDispatch = await dispatch.save();

      // Update driver state
      driver.availability = "ON_TRIP";
      driver.currentDispatchId = dispatch.dispatchId;
      await driver.save();

      await logAudit({
        userId: assignedByUserId,
        action: "MANUAL_DRIVER_ASSIGN",
        entityType: "Dispatch",
        entityId: dispatch.dispatchId,
        details: {
          driverId: driver.driverId,
          driverName: driver.fullName,
          vehicleRegistration: driver.vehicleRegistration,
          role: assignedByRole,
          description: `Manual driver assignment: Driver ${driver.fullName} (${driver.vehicleRegistration}) manually assigned to dispatch ${dispatch.dispatchId}. Mode: MANUAL.`,
        },
      });
    }

    // 5. Handle Pickup Task Assignment
    if (pickupTaskId) {
      const pickupTask = await PickupTaskModel.findOne({
        $or: [{ taskId: pickupTaskId }, ...(mongoose.Types.ObjectId.isValid(pickupTaskId) ? [{ _id: pickupTaskId }] : [])],
      });

      if (!pickupTask) {
        throw new Error(`Pickup task with ID "${pickupTaskId}" not found.`);
      }

      pickupTask.driverId = driver.userId || driver.driverId;
      pickupTask.driverName = driver.fullName;
      pickupTask.driverPhone = driver.phone;
      pickupTask.vehicleRegistration = input.vehicleRegistration || driver.vehicleRegistration;
      pickupTask.vehicleType = input.vehicleType || driver.vehicleType;
      pickupTask.status = "ASSIGNED";
      pickupTask.statusHistory.push({
        status: "ASSIGNED",
        timestamp: new Date(),
        note: `Manual assignment to ${driver.fullName} by ${assignedByName || assignedByRole}. ${overrideReason || ""}`.trim(),
      });

      updatedPickup = await pickupTask.save();

      // Update driver state
      driver.availability = "ON_TRIP";
      await driver.save();

      await logAudit({
        userId: assignedByUserId,
        action: "MANUAL_DRIVER_ASSIGN",
        entityType: "PickupTask",
        entityId: pickupTask.taskId,
        details: {
          driverId: driver.driverId,
          driverName: driver.fullName,
          vehicleRegistration: driver.vehicleRegistration,
          role: assignedByRole,
          description: `Manual driver assignment: Driver ${driver.fullName} assigned to customer pickup ${pickupTask.taskId}. Mode: MANUAL.`,
        },
      });
    }

    return {
      success: true,
      message: `Driver ${driver.fullName} successfully assigned in Manual Mode.`,
      dispatch: updatedDispatch,
      pickupTask: updatedPickup,
    };
  }

  /**
   * Safely updates driver availability with state transition validation.
   */
  async updateDriverStatus(
    driverId: string,
    newStatus: DriverAvailability,
    updatedByUserId: string,
    updatedByRole: string,
    notes?: string
  ): Promise<{ success: boolean; driver: any; message: string }> {
    const isObjectId = mongoose.Types.ObjectId.isValid(driverId);
    const driver = await DriverModel.findOne({
      $or: [{ driverId }, ...(isObjectId ? [{ _id: driverId }] : []), { userId: driverId }],
    });

    if (!driver) {
      throw new Error(`Driver with ID "${driverId}" was not found.`);
    }

    const currentStatus = driver.availability;

    // Validate Status Transitions
    if (currentStatus === newStatus) {
      return { success: true, driver, message: `Driver is already in ${newStatus} status.` };
    }

    // Disallow moving directly from MAINTENANCE or OFF_DUTY to ON_TRIP without becoming AVAILABLE first
    if ((currentStatus === "MAINTENANCE" || currentStatus === "OFF_DUTY") && newStatus === "ON_TRIP") {
      throw new Error(`Invalid status transition: Driver cannot move from ${currentStatus} directly to ON_TRIP. Status must be AVAILABLE first.`);
    }

    // Check if trying to set to AVAILABLE while active trips exist
    if (newStatus === "AVAILABLE") {
      const activeCount = await DispatchModel.countDocuments({
        $or: [{ driverId: driver.userId }, { driverId: driver.driverId }, { driverId: driver._id.toString() }],
        status: { $in: ["EN_ROUTE", "PICKED_UP", "IN_TRANSIT", "ON_BREAK", "ARRIVED_AT_FACTORY"] },
      });
      if (activeCount > 0) {
        throw new Error(`Cannot set driver to AVAILABLE: Driver has ${activeCount} in-transit trip(s) in progress.`);
      }
    }

    driver.availability = newStatus;
    if (notes) {
      driver.notes = notes;
    }
    if (newStatus === "AVAILABLE" || newStatus === "OFF_DUTY" || newStatus === "MAINTENANCE") {
      driver.currentDispatchId = undefined;
    }

    await driver.save();

    await logAudit({
      userId: updatedByUserId,
      action: "UPDATE_DRIVER_STATUS",
      entityType: "Driver",
      entityId: driver.driverId,
      details: {
        previousStatus: currentStatus,
        newStatus,
        role: updatedByRole,
        description: `Driver availability updated from ${currentStatus} to ${newStatus}. Notes: ${notes || "None"}`,
      },
    });

    return {
      success: true,
      driver,
      message: `Driver status successfully updated to ${newStatus}.`,
    };
  }

  /**
   * AI Route and Payload Optimization:
   * Uses QpiAI exclusively.
   * Checks that Manual Mode does NOT block the automated run.
   */
  async runAiOptimization(params: {
    batchIds?: string[];
    destination?: { name: string; latitude: number; longitude: number };
    userId: string;
    userRole: string;
    forceAI?: boolean;
  }): Promise<any> {
    const modeInfo = await this.getOperatingMode();

    if (modeInfo.mode === "MANUAL" && !params.forceAI) {
      return {
        success: false,
        status: "MANUAL_MODE_ACTIVE",
        message: "Manual Mode is active. Automated AI driver overwriting is blocked to protect manual assignments. Switch to AI Mode to enable automatic optimization.",
        operatingMode: "MANUAL",
      };
    }

    // Gather Batches
    let batchesQuery: any = { status: { $in: ["AGGREGATED", "STORED", "READY_FOR_DISPATCH"] } };
    if (params.batchIds && params.batchIds.length > 0) {
      batchesQuery = {
        $or: [
          { batchId: { $in: params.batchIds } },
          ...(params.batchIds.some((id) => mongoose.Types.ObjectId.isValid(id))
            ? [{ _id: { $in: params.batchIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } }]
            : []),
        ],
      };
    }

    const batches = await WasteBatchModel.find(batchesQuery).lean();
    if (batches.length === 0) {
      return {
        success: false,
        status: "NO_BATCHES_AVAILABLE",
        message: "No batches are currently available for AI route optimization.",
      };
    }

    // Gather Real Drivers
    const allDrivers = await this.getRealDriversWithActiveStatus();
    const availableDrivers = allDrivers.filter((d) => d.availability === "AVAILABLE");

    if (availableDrivers.length === 0) {
      return {
        success: false,
        status: "NO_DRIVERS_AVAILABLE",
        message: "No drivers with AVAILABLE status are currently ready for AI assignment.",
      };
    }

    const batchInputs: BatchOptimizationInput[] = batches.map((b: any) => ({
      batchId: b.batchId,
      name: `Batch ${b.batchId} (${b.categoryName || "E-Waste"})`,
      location: b.currentFacilityId || "Dealer Collection Hub",
      weightKg: b.weightKg,
      latitude: 12.9716,
      longitude: 77.5946,
    }));

    const driverInputs: DriverOptimizationInput[] = availableDrivers.map((d: any) => ({
      id: d.id,
      driverId: d.driverId,
      fullName: d.fullName,
      phone: d.phone,
      vehicleRegistration: d.vehicleRegistration,
      vehicleType: d.vehicleType,
      capacityKg: d.loadCapacityKg,
      availability: d.availability,
      latitude: 12.9716,
      longitude: 77.5946,
    }));

    // Execute QpiAI Opt solver
    const qpiResult = await qpiAiService.runDriverAllocationOptimization(
      batchInputs,
      driverInputs,
      params.destination,
      undefined,
      params.userId
    );

    return {
      ...qpiResult,
      operatingMode: "AI",
      provider: "QpiAI_Opt",
    };
  }
}

export const driverAIService = new DriverAIService();
