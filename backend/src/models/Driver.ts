import mongoose, { Schema, Document } from "mongoose";

export type DriverAvailability = "AVAILABLE" | "ON_TRIP" | "MAINTENANCE" | "OFF_DUTY";

export interface IDriver extends Document {
  id: string;
  driverId: string;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber?: string;
  vehicleType: string;
  vehicleRegistration: string;
  loadCapacityKg: number;
  availability: DriverAvailability;
  currentDispatchId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    driverId: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    userId: { type: String, ref: "User", index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    vehicleType: { type: String, required: true, trim: true },
    vehicleRegistration: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    loadCapacityKg: { type: Number, required: true, min: 1 },
    availability: {
      type: String,
      enum: ["AVAILABLE", "ON_TRIP", "MAINTENANCE", "OFF_DUTY"],
      default: "AVAILABLE",
      index: true,
    },
    currentDispatchId: { type: String, ref: "Dispatch" },
    notes: { type: String },
    createdBy: { type: String, ref: "User" },
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

export const DriverModel = mongoose.models.Driver || mongoose.model<IDriver>("Driver", DriverSchema);
