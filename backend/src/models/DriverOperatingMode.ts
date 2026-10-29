import mongoose, { Schema, Document } from "mongoose";

export type OperatingModeType = "AI" | "MANUAL";

export interface IDriverOperatingMode extends Document {
  id: string;
  scope: string; // "GLOBAL" or dealerId
  mode: OperatingModeType;
  updatedBy: string;
  updatedByName?: string;
  updatedByRole: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverOperatingModeSchema = new Schema<IDriverOperatingMode>(
  {
    scope: { type: String, required: true, unique: true, index: true, default: "GLOBAL" },
    mode: { type: String, enum: ["AI", "MANUAL"], default: "MANUAL", required: true },
    updatedBy: { type: String, ref: "User", required: true },
    updatedByName: { type: String },
    updatedByRole: { type: String, required: true },
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

export const DriverOperatingModeModel =
  mongoose.models.DriverOperatingMode ||
  mongoose.model<IDriverOperatingMode>("DriverOperatingMode", DriverOperatingModeSchema);
