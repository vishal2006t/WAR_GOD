import mongoose, { Schema, Document } from "mongoose";

export interface IReceivingRecord extends Document {
  id: string;
  batchId: string;
  dispatchId: string;
  facilityId: string;
  receiverUserId: string;
  measuredWeightKg: number;
  acceptedWeightKg: number;
  rejectedWeightKg: number;
  isDisputed: boolean;
  discrepancyReason?: string;
  inspectionNotes?: string;
  storageLocation?: string;
  evidenceHash?: string;
  txHash?: string;
  arrivalTime: Date;
  createdAt: Date;
}

const ReceivingRecordSchema = new Schema<IReceivingRecord>(
  {
    batchId: { type: String, ref: "WasteBatch", required: true, index: true },
    dispatchId: { type: String, ref: "Dispatch", required: true, index: true },
    facilityId: { type: String, ref: "Facility", required: true },
    receiverUserId: { type: String, ref: "User", required: true },
    measuredWeightKg: { type: Number, required: true },
    acceptedWeightKg: { type: Number, required: true },
    rejectedWeightKg: { type: Number, default: 0 },
    isDisputed: { type: Boolean, default: false },
    discrepancyReason: { type: String },
    inspectionNotes: { type: String },
    storageLocation: { type: String },
    evidenceHash: { type: String },
    txHash: { type: String },
    arrivalTime: { type: Date, default: Date.now },
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

export const ReceivingRecordModel =
  mongoose.models.ReceivingRecord || mongoose.model<IReceivingRecord>("ReceivingRecord", ReceivingRecordSchema);
