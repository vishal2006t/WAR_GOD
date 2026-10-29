import mongoose, { Schema, Document } from "mongoose";

export type OptimizationEngine =
  | "QpiAI_Opt_HiGHS_MILP"
  | "QpiAI_Opt_Quantum_AI"
  | "Local_Heuristic_Planner";

export type OptimizationStatus =
  | "QPIAI_OPTIMIZATION_SUCCEEDED"
  | "EMPTY_INPUT_NO_BATCHES"
  | "NO_AVAILABLE_DRIVERS"
  | "NO_FEASIBLE_ASSIGNMENT"
  | "MALFORMED_INPUT_PAYLOAD"
  | "QPIAI_OPT_CONFIG_MISSING"
  | "QPIAI_AUTH_FAILED"
  | "QPIAI_SERVICE_UNAVAILABLE"
  | "QPIAI_SOLVER_FAILED"
  | "QPIAI_RESULT_VALIDATION_FAILED";

export interface IOptimizedWaypoint {
  batchId?: string;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  weightKg: number;
  sequenceOrder: number;
}

export interface IDriverAssignment {
  driverId: string;
  driverName: string;
  vehicleRegistration: string;
  vehicleType: string;
  vehicleCapacityKg: number;
  assignedPayloadKg: number;
  capacityUtilizationPercent: number;
  assignedBatchIds: string[];
  routeWaypoints: IOptimizedWaypoint[];
  estimatedDistanceKm: number;
  estimatedTravelCostInr: number;
  co2SavingsKg: number | null;
  co2SavingsExplanation?: string;
}

export interface IUnassignedBatch {
  batchId: string;
  weightKg: number;
  reason: string;
}

export interface IOptimizationReport extends Document {
  id: string;
  reportId: string;
  runTimestamp: Date;
  status: OptimizationStatus;
  engine: OptimizationEngine;
  solverName?: string;
  hardwareBackend?: string;
  executionMode: string;
  solverStatus: string;
  problemClass: string;
  objectiveValue: number;
  runtimeMs: number;
  eligibleBatchesCount: number;
  availableDriversCount: number;
  assignedBatchesCount: number;
  unassignedBatchesCount: number;
  unassignedBatches: IUnassignedBatch[];
  driverAssignments: IDriverAssignment[];
  fleetSummary: {
    totalDispatchedWeightKg: number;
    totalFleetDistanceKm: number;
    totalFleetCostInr: number;
    totalCo2SavingsKg: number | null;
    co2SavingsExplanation?: string;
    averageCapacityUtilizationPercent: number;
  };
  baselineComparison: {
    baselineDistanceKm: number;
    baselineCostInr: number;
    distanceReductionPercent: number;
    costSavingsInr: number;
    co2ReductionPercent: number;
    baselineRuntimeMs: number;
  };
  constraintsValidation: {
    capacityFeasible: boolean;
    noDuplicateAssignments: boolean;
    driverAvailabilityVerified: boolean;
  };
  apiAuthStatus: {
    configured: boolean;
    serverAuthenticated: boolean;
    endpoint: string;
    details?: string;
  };
  persistedStatus: "PENDING_COMMIT" | "COMMITTED" | "REJECTED";
  committedDispatches?: {
    dispatchId: string;
    driverId: string;
    batchIds: string[];
  }[];
  committedBy?: string;
  committedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OptimizedWaypointSchema = new Schema<IOptimizedWaypoint>(
  {
    batchId: { type: String },
    name: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    weightKg: { type: Number, required: true },
    sequenceOrder: { type: Number, required: true },
  },
  { _id: false }
);

const DriverAssignmentSchema = new Schema<IDriverAssignment>(
  {
    driverId: { type: String, required: true },
    driverName: { type: String, required: true },
    vehicleRegistration: { type: String, required: true },
    vehicleType: { type: String, required: true },
    vehicleCapacityKg: { type: Number, required: true },
    assignedPayloadKg: { type: Number, required: true },
    capacityUtilizationPercent: { type: Number, required: true },
    assignedBatchIds: [{ type: String }],
    routeWaypoints: [OptimizedWaypointSchema],
    estimatedDistanceKm: { type: Number, required: true },
    estimatedTravelCostInr: { type: Number, required: true },
    co2SavingsKg: { type: Number, default: null },
    co2SavingsExplanation: { type: String },
  },
  { _id: false }
);

const UnassignedBatchSchema = new Schema<IUnassignedBatch>(
  {
    batchId: { type: String, required: true },
    weightKg: { type: Number, required: true },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const OptimizationReportSchema = new Schema<IOptimizationReport>(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    runTimestamp: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: [
        "QPIAI_OPTIMIZATION_SUCCEEDED",
        "EMPTY_INPUT_NO_BATCHES",
        "NO_AVAILABLE_DRIVERS",
        "NO_FEASIBLE_ASSIGNMENT",
        "MALFORMED_INPUT_PAYLOAD",
        "QPIAI_OPT_CONFIG_MISSING",
        "QPIAI_AUTH_FAILED",
        "QPIAI_SERVICE_UNAVAILABLE",
        "QPIAI_SOLVER_FAILED",
        "QPIAI_RESULT_VALIDATION_FAILED",
      ],
      required: true,
      index: true,
    },
    engine: {
      type: String,
      enum: ["QpiAI_Opt_HiGHS_MILP", "QpiAI_Opt_Quantum_AI", "Local_Heuristic_Planner"],
      required: true,
    },
    solverName: { type: String, default: "HiGHS" },
    hardwareBackend: { type: String, default: "Classical CPU (Local execution)" },
    executionMode: { type: String, default: "local" },
    solverStatus: { type: String, default: "OPTIMAL" },
    problemClass: { type: String, default: "MILP" },
    objectiveValue: { type: Number, default: 0 },
    runtimeMs: { type: Number, default: 0 },
    eligibleBatchesCount: { type: Number, default: 0 },
    availableDriversCount: { type: Number, default: 0 },
    assignedBatchesCount: { type: Number, default: 0 },
    unassignedBatchesCount: { type: Number, default: 0 },
    unassignedBatches: [UnassignedBatchSchema],
    driverAssignments: [DriverAssignmentSchema],
    fleetSummary: {
      totalDispatchedWeightKg: { type: Number, default: 0 },
      totalFleetDistanceKm: { type: Number, default: 0 },
      totalFleetCostInr: { type: Number, default: 0 },
      totalCo2SavingsKg: { type: Number, default: null },
      co2SavingsExplanation: { type: String },
      averageCapacityUtilizationPercent: { type: Number, default: 0 },
    },
    baselineComparison: {
      baselineDistanceKm: { type: Number, default: 0 },
      baselineCostInr: { type: Number, default: 0 },
      distanceReductionPercent: { type: Number, default: 0 },
      costSavingsInr: { type: Number, default: 0 },
      co2ReductionPercent: { type: Number, default: 0 },
      baselineRuntimeMs: { type: Number, default: 0 },
    },
    constraintsValidation: {
      capacityFeasible: { type: Boolean, default: true },
      noDuplicateAssignments: { type: Boolean, default: true },
      driverAvailabilityVerified: { type: Boolean, default: true },
    },
    apiAuthStatus: {
      configured: { type: Boolean, default: false },
      serverAuthenticated: { type: Boolean, default: false },
      endpoint: { type: String, default: "https://opt-server.qpiai.tech/" },
      details: { type: String },
    },
    persistedStatus: {
      type: String,
      enum: ["PENDING_COMMIT", "COMMITTED", "REJECTED"],
      default: "PENDING_COMMIT",
      index: true,
    },
    committedDispatches: [
      {
        dispatchId: { type: String },
        driverId: { type: String },
        batchIds: [{ type: String }],
      },
    ],
    committedBy: { type: String, ref: "User" },
    committedAt: { type: Date },
    notes: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

export const OptimizationReportModel =
  mongoose.models.OptimizationReport ||
  mongoose.model<IOptimizationReport>("OptimizationReport", OptimizationReportSchema);
