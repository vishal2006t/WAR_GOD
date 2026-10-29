import mongoose, { Schema, Document } from "mongoose";

export interface IRecoveredMaterial extends Document {
  id: string;
  materialBatchId: string;
  sourceBatchId: string;
  processingRecordId: string;
  materialType: string;
  recoveredWeightKg: number;
  claimedWeightKg: number;
  purityPercentage?: number;
  location?: string;
  evidenceHash?: string;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecoveredMaterialSchema = new Schema<IRecoveredMaterial>(
  {
    materialBatchId: { type: String, required: true, unique: true, index: true },
    sourceBatchId: { type: String, ref: "WasteBatch", required: true },
    processingRecordId: { type: String, ref: "ProcessingRecord", required: true },
    materialType: { type: String, required: true, index: true },
    recoveredWeightKg: { type: Number, required: true },
    claimedWeightKg: { type: Number, default: 0 },
    purityPercentage: { type: Number, default: 99.0 },
    location: { type: String },
    evidenceHash: { type: String },
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

export const RecoveredMaterialModel =
  mongoose.models.RecoveredMaterial || mongoose.model<IRecoveredMaterial>("RecoveredMaterial", RecoveredMaterialSchema);
