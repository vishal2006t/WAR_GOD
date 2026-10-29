import mongoose, { Schema, Document } from "mongoose";

export type CosmeticGrade = "A_MINT" | "B_GOOD" | "C_FAIR" | "D_HEAVILY_USED";
export type InspectionDecision =
  | "REUSABLE_RESALE"
  | "REPAIR_REQUIRED"
  | "RECYCLE_ONLY"
  | "UNSAFE_HAZARDOUS";

export interface IFunctionalTests {
  powerOn: boolean;
  displayWorks: boolean;
  touchOrKeysWork: boolean;
  batteryCharges: boolean;
  connectivityWorks: boolean;
  audioPortsWork: boolean;
}

export interface IProductInspection extends Document {
  id: string;
  inspectionId: string;
  listingId: string;
  dealerId: string;
  inspectorName: string;
  cosmeticGrade: CosmeticGrade;
  functionalTests: IFunctionalTests;
  decision: InspectionDecision;
  findings: string;
  repairPerformed?: string;
  replacedComponents?: string;
  suggestedResalePrice?: number;
  warrantyMonths: number;
  inspectionReportHash?: string;
  photos: string[];
  resaleProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductInspectionSchema = new Schema<IProductInspection>(
  {
    inspectionId: { type: String, required: true, unique: true, index: true },
    listingId: { type: String, ref: "ProductListing", required: true, index: true },
    dealerId: { type: String, ref: "User", required: true, index: true },
    inspectorName: { type: String, required: true },
    cosmeticGrade: {
      type: String,
      enum: ["A_MINT", "B_GOOD", "C_FAIR", "D_HEAVILY_USED"],
      required: true,
    },
    functionalTests: {
      powerOn: { type: Boolean, default: false },
      displayWorks: { type: Boolean, default: false },
      touchOrKeysWork: { type: Boolean, default: false },
      batteryCharges: { type: Boolean, default: false },
      connectivityWorks: { type: Boolean, default: false },
      audioPortsWork: { type: Boolean, default: false },
    },
    decision: {
      type: String,
      enum: ["REUSABLE_RESALE", "REPAIR_REQUIRED", "RECYCLE_ONLY", "UNSAFE_HAZARDOUS"],
      required: true,
      index: true,
    },
    findings: { type: String, required: true },
    repairPerformed: { type: String },
    replacedComponents: { type: String },
    suggestedResalePrice: { type: Number },
    warrantyMonths: { type: Number, default: 3 },
    inspectionReportHash: { type: String },
    photos: [{ type: String }],
    resaleProductId: { type: String, ref: "ResaleProduct" },
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

export const ProductInspectionModel =
  mongoose.models.ProductInspection ||
  mongoose.model<IProductInspection>("ProductInspection", ProductInspectionSchema);
