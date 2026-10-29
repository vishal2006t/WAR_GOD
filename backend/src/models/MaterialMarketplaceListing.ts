import mongoose, { Schema, Document } from "mongoose";

export type MaterialListingStatus = "PUBLISHED" | "PAUSED" | "SOLD_OUT" | "WITHDRAWN";

export interface IMaterialMarketplaceListing extends Document {
  id: string;
  listingId: string;
  factoryId: string;
  factoryName: string;
  sourceMaterialBatchId: string;
  sourceWasteBatchId: string;
  materialType: string;
  purityPercentage: number;
  grade: string;
  unit: string; // e.g. "kg", "MT"
  totalListedWeightKg: number;
  availableStockKg: number;
  reservedStockKg: number;
  pricePerKg: number;
  minimumOrderKg: number;
  qualityReportHash?: string;
  description?: string;
  location?: string;
  status: MaterialListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialMarketplaceListingSchema = new Schema<IMaterialMarketplaceListing>(
  {
    listingId: { type: String, required: true, unique: true, index: true },
    factoryId: { type: String, ref: "Facility", required: true, index: true },
    factoryName: { type: String, required: true },
    sourceMaterialBatchId: { type: String, ref: "RecoveredMaterial", required: true, index: true },
    sourceWasteBatchId: { type: String, ref: "WasteBatch", required: true, index: true },
    materialType: { type: String, required: true, index: true },
    purityPercentage: { type: Number, required: true },
    grade: { type: String, required: true },
    unit: { type: String, default: "kg" },
    totalListedWeightKg: { type: Number, required: true, min: 0.1 },
    availableStockKg: { type: Number, required: true, min: 0 },
    reservedStockKg: { type: Number, default: 0, min: 0 },
    pricePerKg: { type: Number, required: true, min: 0 },
    minimumOrderKg: { type: Number, default: 1, min: 0.1 },
    qualityReportHash: { type: String },
    description: { type: String },
    location: { type: String },
    status: {
      type: String,
      enum: ["PUBLISHED", "PAUSED", "SOLD_OUT", "WITHDRAWN"],
      default: "PUBLISHED",
      index: true,
    },
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

export const MaterialMarketplaceListingModel =
  mongoose.models.MaterialMarketplaceListing ||
  mongoose.model<IMaterialMarketplaceListing>(
    "MaterialMarketplaceListing",
    MaterialMarketplaceListingSchema
  );
