import mongoose, { Schema, Document } from "mongoose";

export interface IDispatchLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updatedAt: Date;
  isStale?: boolean;
}

export interface IDispatchBreak {
  breakId: string;
  startTime: Date;
  endTime?: Date;
  startLocation?: { latitude: number; longitude: number };
  endLocation?: { latitude: number; longitude: number };
  reason?: string;
}

export interface IDispatch extends Document {
  id: string;
  dispatchId: string;
  driverId?: string;
  dealerId?: string;
  vehicleRegistration: string;
  pickupAddress: string;
  destinationFacilityId: string;
  dispatchedWeightKg: number;
  pickupWeightKg?: number;
  deliveryWeightKg?: number;
  receivedWeightKg?: number;
  status:
    | "REGISTERED"
    | "ASSIGNED"
    | "ACCEPTED"
    | "REJECTED"
    | "EN_ROUTE"
    | "PICKED_UP"
    | "IN_TRANSIT"
    | "ON_BREAK"
    | "ARRIVED_AT_FACTORY"
    | "DELIVERED"
    | "RECEIVED"
    | "DISPUTED"
    | "EXCEPTION";
  rejectionReason?: string;
  exceptionReason?: string;
  pickupProofHash?: string;
  deliveryProofHash?: string;
  deliveryProofUrl?: string;
  pickupTime?: Date;
  deliveryTime?: Date;
  discrepancyNotes?: string;
  txHash?: string;
  batchIds: string[];

  // Live Tracking & Trip Management
  lastKnownLocation?: IDispatchLocation;
  tripStartedAt?: Date;
  tripCompletedAt?: Date;
  breaks: IDispatchBreak[];
  currentBreak?: IDispatchBreak;
  locationHistory: Array<{
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    timestamp: Date;
  }>;
  geofenceArrivalDetected?: boolean;
  geofenceArrivalTime?: Date;
  deliveryConfirmationOtp?: string;
  deliveryConfirmedByUserId?: string;
  deliveryConfirmedAt?: Date;
  etaMinutes?: number;
  distanceKm?: number;
  staleNotificationSent?: boolean;
  operatingMode?: "AI" | "MANUAL";
  assignedBy?: string;
  assignmentMethod?: "AI_RECOMMENDED" | "MANUAL_OVERRIDE" | "MANUAL_DIRECT";
  manualOverrideReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const LocationUpdateSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heading: { type: Number },
    speed: { type: Number },
    accuracy: { type: Number },
    updatedAt: { type: Date, default: Date.now },
    isStale: { type: Boolean, default: false },
  },
  { _id: false }
);

const BreakSchema = new Schema(
  {
    breakId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    startLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    endLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    reason: { type: String },
  },
  { _id: false }
);

const DispatchSchema = new Schema<IDispatch>(
  {
    dispatchId: { type: String, required: true, unique: true, index: true },
    driverId: { type: String, ref: "User", index: true },
    dealerId: { type: String, ref: "User", index: true },
    vehicleRegistration: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    destinationFacilityId: { type: String, ref: "Facility", required: true, index: true },
    dispatchedWeightKg: { type: Number, required: true },
    pickupWeightKg: { type: Number },
    deliveryWeightKg: { type: Number },
    receivedWeightKg: { type: Number },
    status: {
      type: String,
      enum: [
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
      ],
      default: "REGISTERED",
      index: true,
    },
    rejectionReason: { type: String },
    exceptionReason: { type: String },
    pickupProofHash: { type: String },
    deliveryProofHash: { type: String },
    deliveryProofUrl: { type: String },
    pickupTime: { type: Date },
    deliveryTime: { type: Date },
    discrepancyNotes: { type: String },
    txHash: { type: String },
    batchIds: [{ type: String, ref: "WasteBatch" }],
    operatingMode: {
      type: String,
      enum: ["AI", "MANUAL"],
      default: "MANUAL",
      index: true,
    },
    assignedBy: { type: String, ref: "User" },
    assignmentMethod: {
      type: String,
      enum: ["AI_RECOMMENDED", "MANUAL_OVERRIDE", "MANUAL_DIRECT"],
      default: "MANUAL_DIRECT",
    },
    manualOverrideReason: { type: String },

    // Live Tracking & Geofence Fields
    lastKnownLocation: LocationUpdateSchema,
    tripStartedAt: { type: Date },
    tripCompletedAt: { type: Date },
    breaks: [BreakSchema],
    currentBreak: BreakSchema,
    locationHistory: [
      {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        speed: { type: Number },
        heading: { type: Number },
        accuracy: { type: Number },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    geofenceArrivalDetected: { type: Boolean, default: false },
    geofenceArrivalTime: { type: Date },
    deliveryConfirmationOtp: { type: String },
    deliveryConfirmedByUserId: { type: String, ref: "User" },
    deliveryConfirmedAt: { type: Date },
    etaMinutes: { type: Number },
    distanceKm: { type: Number },
    staleNotificationSent: { type: Boolean, default: false },
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

export const DispatchModel =
  mongoose.models.Dispatch || mongoose.model<IDispatch>("Dispatch", DispatchSchema);
