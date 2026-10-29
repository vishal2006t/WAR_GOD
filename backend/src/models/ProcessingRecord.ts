import mongoose, { Schema, Document } from "mongoose";

export interface IProcessingRecord extends Document {
  id: string;
  processingId: string;
  sourceBatchId: string;
  facilityId: string;
  workerUserId: string;
  supervisorUserId?: string;
  inputWeightKg: number;
  totalRecoveredKg: number;
  residualKg: number;
  documentedLossKg: number;
  massBalanceValid: boolean;
  supervisorApproved: boolean;
  supervisorRemarks?: string;
  evidenceHash?: string;
  notes?: string;
  txHash?: string;
  processedAt: Date;
  createdAt: Date;
}

const ProcessingRecordSchema = new Schema<IProcessingRecord>(
  {
    processingId: { type: String, required: true, unique: true, index: true },
    sourceBatchId: { type: String, ref: "WasteBatch", required: true, index: true },
    facilityId: { type: String, ref: "Facility", required: true },
    workerUserId: { type: String, ref: "User", required: true },
    supervisorUserId: { type: String, ref: "User" },
    inputWeightKg: { type: Number, required: true },
    totalRecoveredKg: { type: Number, required: true },
    residualKg: { type: Number, required: true },
    documentedLossKg: { type: Number, required: true },
    massBalanceValid: { type: Boolean, default: true },
    supervisorApproved: { type: Boolean, default: false },
    supervisorRemarks: { type: String },
    evidenceHash: { type: String },
    notes: { type: String },
    txHash: { type: String },
    processedAt: { type: Date, default: Date.now },
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

export const ProcessingRecordModel =
  mongoose.models.ProcessingRecord || mongoose.model<IProcessingRecord>("ProcessingRecord", ProcessingRecordSchema);
