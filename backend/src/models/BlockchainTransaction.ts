import mongoose, { Schema, Document } from "mongoose";

export interface IBlockchainTransaction extends Document {
  id: string;
  txHash: string;
  functionName: string;
  contractAddress?: string;
  fromAddress?: string;
  blockNumber?: number;
  status: string;
  payloadJson?: string;
  timestamp: Date;
}

const BlockchainTransactionSchema = new Schema<IBlockchainTransaction>(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    functionName: { type: String, required: true, index: true },
    contractAddress: { type: String },
    fromAddress: { type: String },
    blockNumber: { type: Number },
    status: { type: String, default: "CONFIRMED" },
    payloadJson: { type: String },
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

export const BlockchainTransactionModel =
  mongoose.models.BlockchainTransaction ||
  mongoose.model<IBlockchainTransaction>("BlockchainTransaction", BlockchainTransactionSchema);
