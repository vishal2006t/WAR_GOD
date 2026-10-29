import mongoose, { Schema, Document } from "mongoose";

export type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface IDealerOffer extends Document {
  id: string;
  offerId: string;
  listingId: string;
  dealerId: string;
  dealerName: string;
  dealerOrganization?: string;
  dealerPhone?: string;
  offeredPrice: number;
  message?: string;
  estimatedPickupHours: number;
  status: OfferStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DealerOfferSchema = new Schema<IDealerOffer>(
  {
    offerId: { type: String, required: true, unique: true, index: true },
    listingId: { type: String, ref: "ProductListing", required: true, index: true },
    dealerId: { type: String, ref: "User", required: true, index: true },
    dealerName: { type: String, required: true },
    dealerOrganization: { type: String },
    dealerPhone: { type: String },
    offeredPrice: { type: Number, required: true, min: 1 },
    message: { type: String },
    estimatedPickupHours: { type: Number, default: 24 },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    rejectionReason: { type: String },
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

export const DealerOfferModel =
  mongoose.models.DealerOffer ||
  mongoose.model<IDealerOffer>("DealerOffer", DealerOfferSchema);
