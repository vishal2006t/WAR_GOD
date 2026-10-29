import mongoose, { Schema, Document } from "mongoose";

export type ResaleProductStatus = "DRAFT" | "PUBLISHED" | "RESERVED" | "SOLD" | "WITHDRAWN";

export interface IResaleProduct {
  id: string;
  resaleId: string;
  dealerId: string;
  dealerName: string;
  dealerOrganization?: string;
  dealerCity?: string;
  approximateLocation?: string;
  sourceListingId?: string;
  sourceInspectionId?: string;
  title: string;
  category: string;
  brand: string;
  model: string;
  description: string;
  images: string[];
  price: number;
  conditionGrade: "A_MINT" | "B_GOOD" | "C_FAIR" | "D_HEAVILY_USED";
  functionalSummary: string;
  repairHistory?: string;
  warrantyMonths: number;
  stock: number;
  reservedStock: number;
  status: ResaleProductStatus;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ResaleProductSchema = new Schema<IResaleProduct>(
  {
    resaleId: { type: String, required: true, unique: true, index: true },
    dealerId: { type: String, ref: "User", required: true, index: true },
    dealerName: { type: String, required: true },
    dealerOrganization: { type: String },
    dealerCity: { type: String, trim: true },
    approximateLocation: { type: String, trim: true },
    sourceListingId: { type: String, ref: "ProductListing" },
    sourceInspectionId: { type: String, ref: "ProductInspection" },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    conditionGrade: {
      type: String,
      enum: ["A_MINT", "B_GOOD", "C_FAIR", "D_HEAVILY_USED"],
      required: true,
      index: true,
    },
    functionalSummary: { type: String, required: true },
    repairHistory: { type: String },
    warrantyMonths: { type: Number, default: 3 },
    stock: { type: Number, required: true, min: 0, default: 1 },
    reservedStock: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "RESERVED", "SOLD", "WITHDRAWN"],
      default: "DRAFT",
      index: true,
    },
    viewsCount: { type: Number, default: 0 },
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

export const ResaleProductModel =
  mongoose.models.ResaleProduct ||
  mongoose.model<IResaleProduct>("ResaleProduct", ResaleProductSchema);
