import mongoose, { Schema, Document } from "mongoose";

export type ListingCondition = "WORKING" | "PARTIALLY_WORKING" | "DAMAGED" | "NOT_WORKING";
export type ListingStatus =
  | "PENDING_INSPECTION"
  | "APPROVED"
  | "LISTED"
  | "REJECTED"
  | "SOLD"
  | "SUBMITTED"
  | "OFFERS_RECEIVED"
  | "OFFER_ACCEPTED"
  | "PICKUP_SCHEDULED"
  | "IN_TRANSIT"
  | "COLLECTED"
  | "CANCELLED";

export interface IBatteryInfo {
  healthState?: string;
  maxCapacityPercent?: number;
  cycleCount?: number;
  batteryNotes?: string;
}

export interface IProductListing {
  id: string;
  listingId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  title: string;
  category: string;
  brand: string;
  model: string;
  ageYears: number;
  description: string;
  condition: ListingCondition;
  expectedPrice: number;
  damageDetails?: string;
  accessories?: string[];
  batteryInfo?: IBatteryInfo;
  listingType?: "P2P_MARKETPLACE" | "DEALER_RECYCLE";
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  images: string[];
  pickupAddress: string;
  approximateLocation: string;
  location?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  preferredPickupDate: string;
  preferredPickupTimeSlot: string;
  status: ListingStatus;
  offersCount: number;
  acceptedOfferId?: string;
  assignedDealerId?: string;
  assignedDealerName?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  pickupTaskId?: string;
  pickupHandoverOtp?: string;
  actualWeightKg?: number;
  pickupProofPhotos?: string[];
  collectedAt?: Date;
  cancellationReason?: string;
  inspectionId?: string;
  resaleProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
  { _id: false }
);

const ProductListingSchema = new Schema<IProductListing>(
  {
    listingId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, ref: "User", required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String },
    customerPhone: { type: String },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    ageYears: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    condition: {
      type: String,
      enum: ["WORKING", "PARTIALLY_WORKING", "DAMAGED", "NOT_WORKING"],
      required: true,
      index: true,
    },
    expectedPrice: { type: Number, required: true, min: 0 },
    damageDetails: { type: String, default: "" },
    accessories: [{ type: String }],
    batteryInfo: {
      healthState: { type: String },
      maxCapacityPercent: { type: Number },
      cycleCount: { type: Number },
      batteryNotes: { type: String },
    },
    listingType: {
      type: String,
      enum: ["P2P_MARKETPLACE", "DEALER_RECYCLE"],
      default: "P2P_MARKETPLACE",
    },
    reviewNotes: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    images: [{ type: String }],
    pickupAddress: { type: String, required: true },
    approximateLocation: { type: String, required: true },
    location: {
      type: PointSchema,
      default: undefined,
    },
    preferredPickupDate: { type: String, required: true },
    preferredPickupTimeSlot: { type: String, default: "Morning (9 AM - 1 PM)" },
    status: {
      type: String,
      enum: [
        "PENDING_INSPECTION",
        "APPROVED",
        "LISTED",
        "REJECTED",
        "SOLD",
        "SUBMITTED",
        "OFFERS_RECEIVED",
        "OFFER_ACCEPTED",
        "PICKUP_SCHEDULED",
        "IN_TRANSIT",
        "COLLECTED",
        "CANCELLED",
      ],
      default: "PENDING_INSPECTION",
      index: true,
    },
    offersCount: { type: Number, default: 0 },
    acceptedOfferId: { type: String, ref: "DealerOffer" },
    assignedDealerId: { type: String, ref: "User", index: true },
    assignedDealerName: { type: String },
    assignedDriverId: { type: String, ref: "Driver" },
    assignedDriverName: { type: String },
    pickupTaskId: { type: String, ref: "PickupTask" },
    pickupHandoverOtp: { type: String },
    actualWeightKg: { type: Number },
    pickupProofPhotos: [{ type: String }],
    collectedAt: { type: Date },
    cancellationReason: { type: String },
    inspectionId: { type: String, ref: "ProductInspection" },
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

// 2dsphere index for MongoDB proximity queries (sparse so documents without location are valid)
ProductListingSchema.index({ location: "2dsphere" }, { sparse: true });

export const ProductListingModel =
  mongoose.models.ProductListing ||
  mongoose.model<IProductListing>("ProductListing", ProductListingSchema);
