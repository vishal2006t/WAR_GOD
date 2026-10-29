import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  id: string;
  productId: string;
  serialNumber?: string;
  name: string;
  brandModel?: string;
  sourceBatchId?: string;
  condition: string;
  refurbishmentDate: Date;
  replacedComponents?: string;
  inspectionReportHash?: string;
  technicianApproved: boolean;
  technicianName?: string;
  warrantyMonths: number;
  qrCodeData?: string;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    productId: { type: String, required: true, unique: true, index: true },
    serialNumber: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true },
    brandModel: { type: String },
    sourceBatchId: { type: String, ref: "WasteBatch" },
    condition: { type: String, required: true },
    refurbishmentDate: { type: Date, default: Date.now },
    replacedComponents: { type: String },
    inspectionReportHash: { type: String },
    technicianApproved: { type: Boolean, default: true },
    technicianName: { type: String },
    warrantyMonths: { type: Number, default: 6 },
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

export const ProductModel = mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
