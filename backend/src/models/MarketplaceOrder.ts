import mongoose, { Schema, Document } from "mongoose";

export type MarketplaceItemType = "REFURBISHED_PRODUCT" | "RECOVERED_MATERIAL" | "P2P_PRODUCT";
export type OrderPaymentStatus = "PENDING" | "VERIFIED_PAID" | "FAILED" | "REFUNDED";
export type OrderFulfillmentStatus = "PLACED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";

export interface IMarketplaceOrder extends Document {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  itemType: MarketplaceItemType;
  resaleProductId?: string;
  materialListingId?: string;
  p2pListingId?: string;
  itemTitle: string;
  sellerId: string;
  sellerName: string;
  sellerRole: "DEALER" | "FACTORY" | "CUSTOMER";
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  shippingAddress: {
    fullName: string;
    phone: string;
    streetAddress: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentMethod: "TEST_UPI" | "TEST_CARD" | "TEST_NETBANKING" | "COD";
  paymentStatus: OrderPaymentStatus;
  paymentTxRef?: string;
  paymentVerifiedAt?: Date;
  orderStatus: OrderFulfillmentStatus;
  trackingNumber?: string;
  cancellationReason?: string;
  notes?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MarketplaceOrderSchema = new Schema<IMarketplaceOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, ref: "User", required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String },
    itemType: {
      type: String,
      enum: ["REFURBISHED_PRODUCT", "RECOVERED_MATERIAL", "P2P_PRODUCT"],
      required: true,
      index: true,
    },
    resaleProductId: { type: String, ref: "ResaleProduct", index: true },
    materialListingId: { type: String, ref: "MaterialMarketplaceListing", index: true },
    p2pListingId: { type: String, ref: "ProductListing", index: true },
    itemTitle: { type: String, required: true },
    sellerId: { type: String, required: true, index: true },
    sellerName: { type: String, required: true },
    sellerRole: { type: String, enum: ["DEALER", "FACTORY", "CUSTOMER"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      streetAddress: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ["TEST_UPI", "TEST_CARD", "TEST_NETBANKING", "COD"],
      default: "TEST_UPI",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED_PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    paymentTxRef: { type: String },
    paymentVerifiedAt: { type: Date },
    orderStatus: {
      type: String,
      enum: ["PLACED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"],
      default: "PLACED",
      index: true,
    },
    trackingNumber: { type: String },
    cancellationReason: { type: String },
    notes: { type: String },
    deliveredAt: { type: Date },
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

export const MarketplaceOrderModel =
  mongoose.models.MarketplaceOrder ||
  mongoose.model<IMarketplaceOrder>("MarketplaceOrder", MarketplaceOrderSchema);
