import mongoose, { Schema, Document } from "mongoose";

export interface IFacility extends Document {
  id: string;
  name: string;
  code: string;
  facilityType: string;
  address: string;
  contactEmail: string;
  contactPhone?: string;
  authorized: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
  geofenceRadiusMeters?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FacilitySchema = new Schema<IFacility>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    facilityType: { type: String, required: true },
    address: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String },
    authorized: { type: Boolean, default: true },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    geofenceRadiusMeters: { type: Number, default: 500 },
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

export const FacilityModel = mongoose.models.Facility || mongoose.model<IFacility>("Facility", FacilitySchema);
