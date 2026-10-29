import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  id: string;
  userId: string;
  role?: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ALERT";
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, ref: "User", required: true, index: true },
    role: { type: String, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["INFO", "SUCCESS", "WARNING", "ALERT"],
      default: "INFO",
    },
    entityType: { type: String },
    entityId: { type: String },
    actionUrl: { type: String },
    read: { type: Boolean, default: false, index: true },
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

export const NotificationModel =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
