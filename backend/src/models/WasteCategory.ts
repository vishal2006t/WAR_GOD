import mongoose, { Schema, Document } from "mongoose";

export interface IWasteCategory extends Document {
  id: string;
  name: string;
  code: string;
  description?: string;
}

const WasteCategorySchema = new Schema<IWasteCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String },
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

export const WasteCategoryModel =
  mongoose.models.WasteCategory || mongoose.model<IWasteCategory>("WasteCategory", WasteCategorySchema);
