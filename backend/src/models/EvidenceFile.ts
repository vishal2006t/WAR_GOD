import mongoose, { Schema, Document } from "mongoose";

export interface IEvidenceFile extends Document {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  filePath: string;
  uploadedByUserId?: string;
  createdAt: Date;
}

const EvidenceFileSchema = new Schema<IEvidenceFile>(
  {
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    sha256Hash: { type: String, required: true, index: true },
    filePath: { type: String, required: true },
    uploadedByUserId: { type: String, ref: "User" },
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

export const EvidenceFileModel =
  mongoose.models.EvidenceFile || mongoose.model<IEvidenceFile>("EvidenceFile", EvidenceFileSchema);
