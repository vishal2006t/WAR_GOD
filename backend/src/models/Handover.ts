import mongoose, { Schema, Document } from "mongoose";

export interface IHandover extends Document {
  id: string;
  dispatchId: string;
  senderUserId: string;
  receiverUserId?: string;
  handoverType: string;
  evidenceHash?: string;
  notes?: string;
  txHash?: string;
  timestamp: Date;
}

const HandoverSchema = new Schema<IHandover>(
  {
    dispatchId: { type: String, ref: "Dispatch", required: true, index: true },
    senderUserId: { type: String, ref: "User", required: true },
    receiverUserId: { type: String, ref: "User" },
    handoverType: { type: String, required: true },
    evidenceHash: { type: String },
    notes: { type: String },
    txHash: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
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

export const HandoverModel =
  mongoose.models.Handover || mongoose.model<IHandover>("Handover", HandoverSchema);
