import mongoose, { Schema, Document } from "mongoose";

export type PickupTaskStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COLLECTED"
  | "DELIVERED"
  | "CANCELLED"
  | "RESCHEDULED";

export interface ILocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updatedAt: Date;
}

export interface IPickupTask extends Document {
  id: string;
  taskId: string;
  listingId: string;
  offerId: string;
  dealerId: string;
  dealerName: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleRegistration: string;
  vehicleType: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupCoordinates?: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  productTitle: string;
  agreedPrice: number;
  status: PickupTaskStatus;
  statusHistory: Array<{
    status: PickupTaskStatus;
    timestamp: Date;
    note?: string;
  }>;
  handoverOtp: string;
  handoverOtpVerified: boolean;
  proofPhotos: string[];
  actualWeightKg?: number;
  lastKnownLocation?: ILocationUpdate;
  etaMinutes?: number;
  distanceKm?: number;
  rescheduledDate?: Date;
  cancellationReason?: string;
  notes?: string;
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
  },
  { _id: false }
);

const PickupTaskSchema = new Schema<IPickupTask>(
  {
    taskId: { type: String, required: true, unique: true, index: true },
    listingId: { type: String, ref: "ProductListing", required: true, index: true },
    offerId: { type: String, ref: "DealerOffer", required: true },
    dealerId: { type: String, ref: "User", required: true, index: true },
    dealerName: { type: String, required: true },
    driverId: { type: String, ref: "User", required: true, index: true },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    vehicleRegistration: { type: String, required: true },
    vehicleType: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    pickupCoordinates: {
      type: new Schema(
        {
          type: { type: String, enum: ["Point"], default: "Point", required: true },
          coordinates: { type: [Number], required: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    productTitle: { type: String, required: true },
    agreedPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "ASSIGNED",
        "ACCEPTED",
        "EN_ROUTE",
        "ARRIVED",
        "COLLECTED",
        "DELIVERED",
        "CANCELLED",
        "RESCHEDULED",
      ],
      default: "ASSIGNED",
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    handoverOtp: { type: String, required: true },
    handoverOtpVerified: { type: Boolean, default: false },
    proofPhotos: [{ type: String }],
    actualWeightKg: { type: Number },
    lastKnownLocation: LocationUpdateSchema,
    etaMinutes: { type: Number },
    distanceKm: { type: Number },
    rescheduledDate: { type: Date },
    cancellationReason: { type: String },
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

PickupTaskSchema.index({ pickupCoordinates: "2dsphere" }, { sparse: true });

export const PickupTaskModel =
  mongoose.models.PickupTask ||
  mongoose.model<IPickupTask>("PickupTask", PickupTaskSchema);
