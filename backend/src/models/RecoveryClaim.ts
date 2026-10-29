import mongoose, { Schema, Document } from "mongoose";

export interface IRecoveryClaim extends Document {
  id: string;
  claimId: string;
  materialBatchId: string;
  claimantName: string;
  claimantOrg: string;
  claimedWeightKg: number;
  verified: boolean;
  isDuplicateAlert: boolean;
  notes?: string;
  txHash?: string;
  claimedAt: Date;
}

const RecoveryClaimSchema = new Schema<IRecoveryClaim>(
  {
    claimId: { type: String, required: true, unique: true, index: true },
    materialBatchId: { type: String, ref: "RecoveredMaterial", required: true, index: true },
    claimantName: { type: String, required: true },
    claimantOrg: { type: String, required: true },
    claimedWeightKg: { type: Number, required: true },
    verified: { type: Boolean, default: true },
    isDuplicateAlert: { type: Boolean, default: false },
    notes: { type: String },
    txHash: { type: String },
    claimedAt: { type: Date, default: Date.now },
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

export const RecoveryClaimModel =
  mongoose.models.RecoveryClaim || mongoose.model<IRecoveryClaim>("RecoveryClaim", RecoveryClaimSchema);
