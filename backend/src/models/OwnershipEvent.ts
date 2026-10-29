import mongoose, { Schema, Document } from "mongoose";

export interface IOwnershipEvent extends Document {
  id: string;
  productId: string;
  eventType: string;
  description: string;
  actorRole?: string;
  actorLabel?: string;
  evidenceRef?: string;
  txHash?: string;
  metadata?: any;
  timestamp: Date;
}

const OwnershipEventSchema = new Schema<IOwnershipEvent>(
  {
    productId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    description: { type: String, required: true },
    actorRole: { type: String },
    actorLabel: { type: String },
    evidenceRef: { type: String },
    txHash: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
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

export const OwnershipEventModel =
  mongoose.models.OwnershipEvent || mongoose.model<IOwnershipEvent>("OwnershipEvent", OwnershipEventSchema);
