import mongoose, { Schema, Document } from "mongoose";

export interface IProductServiceRecord extends Document {
  id: string;
  productId: string;
  serviceDate: Date;
  serviceType: string;
  description: string;
  technicianName: string;
  createdAt: Date;
}

const ProductServiceRecordSchema = new Schema<IProductServiceRecord>(
  {
    productId: { type: String, ref: "Product", required: true, index: true },
    serviceDate: { type: Date, default: Date.now },
    serviceType: { type: String, required: true },
    description: { type: String, required: true },
    technicianName: { type: String, required: true },
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

export const ProductServiceRecordModel =
  mongoose.models.ProductServiceRecord ||
  mongoose.model<IProductServiceRecord>("ProductServiceRecord", ProductServiceRecordSchema);
