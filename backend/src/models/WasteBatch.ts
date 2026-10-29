import mongoose, { Schema, Document } from "mongoose";

export interface IWasteBatch extends Document {
  id: string;
  batchId: string;
  dealerId: string;
  categoryId: string;
  pickupLocation: string;
  sourceType: string;
  description: string;
  initialWeightKg: number;
  contactPhone?: string;
  contactEmail?: string;
  collectionDate?: Date;
  status: "REGISTERED" | "DISPATCHED" | "RECEIVED" | "PROCESSED" | "DISPUTED";
  destinationFacilityId: string;
  evidenceHash?: string;
  weighingSlipUrl?: string;
  qrCodeData?: string;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WasteBatchSchema = new Schema<IWasteBatch>(
  {
    batchId: { type: String, required: true, unique: true, index: true },
    dealerId: { type: String, ref: "User", required: true, index: true },
    categoryId: { type: String, ref: "WasteCategory", required: true, index: true },
    pickupLocation: { type: String, required: true },
    sourceType: { type: String, required: true },
    description: { type: String, required: true },
    initialWeightKg: { type: Number, required: true },
    contactPhone: { type: String },
    contactEmail: { type: String },
    collectionDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["REGISTERED", "DISPATCHED", "RECEIVED", "PROCESSED", "DISPUTED"],
      default: "REGISTERED",
      index: true,
    },
    destinationFacilityId: { type: String, ref: "Facility", required: true, index: true },
    evidenceHash: { type: String },
    weighingSlipUrl: { type: String },
    qrCodeData: { type: String },
    txHash: { type: String },
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

export const WasteBatchModel =
  mongoose.models.WasteBatch || mongoose.model<IWasteBatch>("WasteBatch", WasteBatchSchema);
