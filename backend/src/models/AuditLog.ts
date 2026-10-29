import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson?: string;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, ref: "User" },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    detailsJson: { type: String },
    ipAddress: { type: String, default: "127.0.0.1" },
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

export const AuditLogModel =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
