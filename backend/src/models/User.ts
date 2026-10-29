import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: "ADMIN" | "DEALER" | "DRIVER" | "FACTORY" | "WORKER" | "CUSTOMER";
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";
  employeeId?: string;
  organization?: string;
  facilityId?: string;
  lastLoginAt?: Date;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  statusReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String },
    role: {
      type: String,
      enum: ["ADMIN", "DEALER", "DRIVER", "FACTORY", "WORKER", "CUSTOMER"],
      default: "CUSTOMER",
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "SUSPENDED", "INACTIVE", "ARCHIVED"],
      default: "APPROVED",
      index: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    organization: { type: String },
    facilityId: { type: String, ref: "Facility" },
    lastLoginAt: { type: Date },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedBy: { type: String, ref: "User" },
    statusReason: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete (ret as any).passwordHash;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
