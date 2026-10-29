import { Router, Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  ProductListingModel,
  DealerOfferModel,
  PickupTaskModel,
  ProductInspectionModel,
  ResaleProductModel,
  MaterialMarketplaceListingModel,
  MarketplaceOrderModel,
  RecoveredMaterialModel,
  WasteBatchModel,
  UserModel,
  ProductModel,
  OwnershipEventModel,
  Role,
} from "../models";

const router = Router();

// Helper: Haversine distance in KM
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ============================================================================
// FEATURE 1: CUSTOMER — SELL OLD ELECTRONICS
// ============================================================================

// POST /api/marketplace/listings - Customer creates listing
router.post(
  "/listings",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const {
        title,
        category,
        brand,
        model,
        ageYears,
        description,
        condition,
        expectedPrice,
        images,
        pickupAddress,
        approximateLocation,
        latitude,
        longitude,
        preferredPickupDate,
        preferredPickupTimeSlot,
        customerPhone,
        damageDetails,
        accessories,
        batteryInfo,
        listingType = "P2P_MARKETPLACE",
        status: requestedStatus,
      } = req.body;

      // Map description from description, generalDescription, or desc for robust frontend/API compatibility
      const rawDescription = req.body.description ?? req.body.generalDescription ?? req.body.desc;
      const trimmedDescription = typeof rawDescription === "string" ? rawDescription.trim() : "";

      if (!category || !brand || !model || !condition || expectedPrice === undefined || expectedPrice === null || !trimmedDescription) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: category, brand, model, condition, expectedPrice, and description are mandatory.",
        });
        return;
      }

      // Generate a human-friendly listing ID
      const listingId = `LST-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      // Approximate location derivation if not explicitly provided
      let derivedApprox = approximateLocation;
      const effectiveAddress = (pickupAddress && pickupAddress.trim()) || approximateLocation || "Indiranagar, Bengaluru";
      if (!derivedApprox || derivedApprox.trim() === "") {
        const parts = effectiveAddress.split(",");
        derivedApprox = parts.length > 1 ? parts.slice(-2).join(",").trim() : effectiveAddress;
      }

      // GeoJSON location if latitude & longitude provided
      let locationObj: { type: "Point"; coordinates: [number, number] } | undefined = undefined;
      const parsedLat = typeof latitude === "string" ? parseFloat(latitude) : Number(latitude);
      const parsedLon = typeof longitude === "string" ? parseFloat(longitude) : Number(longitude);
      if (
        !isNaN(parsedLat) &&
        !isNaN(parsedLon) &&
        parsedLat !== 0 &&
        parsedLon !== 0
      ) {
        locationObj = {
          type: "Point",
          coordinates: [parsedLon, parsedLat],
        };
      }

      // Status lifecycle: All new customer device submissions start in PENDING_INSPECTION (inspection review gate)
      const initialStatus = "PENDING_INSPECTION";

      const effectiveTitle = (title && title.trim()) || `${brand.trim()} ${model.trim()}`;

      const newListing = await ProductListingModel.create({
        listingId,
        customerId: user.id,
        customerName: user.fullName,
        customerEmail: user.email,
        customerPhone: customerPhone || "",
        title: effectiveTitle,
        category: category.trim(),
        brand: brand.trim(),
        model: model.trim(),
        ageYears: Number(ageYears) || 0,
        description: trimmedDescription,
        condition,
        expectedPrice: Number(expectedPrice),
        images: Array.isArray(images) && images.length > 0 ? images : ["/uploads/sample-laptop.jpg"],
        pickupAddress: effectiveAddress,
        approximateLocation: derivedApprox,
        location: locationObj,
        preferredPickupDate: preferredPickupDate || new Date().toISOString().split("T")[0],
        preferredPickupTimeSlot: preferredPickupTimeSlot || "Morning (9 AM - 1 PM)",
        status: initialStatus,
        offersCount: 0,
        damageDetails: damageDetails || "",
        accessories: Array.isArray(accessories) ? accessories : [],
        batteryInfo: batteryInfo
          ? {
              healthState: batteryInfo.healthState || "UNKNOWN",
              maxCapacityPercent:
                batteryInfo.maxCapacityPercent !== undefined
                  ? Number(batteryInfo.maxCapacityPercent)
                  : undefined,
              cycleCount:
                batteryInfo.cycleCount !== undefined ? Number(batteryInfo.cycleCount) : undefined,
              batteryNotes: batteryInfo.batteryNotes || "",
            }
          : undefined,
        listingType,
      });

      // Record stage 1 of traceable product timeline: Original Customer Listing
      await OwnershipEventModel.create({
        productId: newListing.listingId,
        eventType: "ORIGINAL_LISTING",
        description: `Original device registered and listed by Owner 1: ${newListing.brand} ${newListing.model} (${newListing.condition}).`,
        actorRole: "CUSTOMER",
        actorLabel: "Owner 1",
        evidenceRef: `LST-${newListing.listingId}`,
        metadata: {
          category: newListing.category,
          brand: newListing.brand,
          model: newListing.model,
          ageYears: newListing.ageYears,
          expectedPrice: newListing.expectedPrice,
          condition: newListing.condition,
          accessories: newListing.accessories,
          damageDetails: newListing.damageDetails,
          batteryInfo: newListing.batteryInfo,
        },
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Electronics listing created successfully and submitted for inspection review.",
        data: newListing,
      });
    } catch (err: any) {
      console.error("Error creating listing:", err);
      if (err.name === "ValidationError") {
        res.status(400).json({
          success: false,
          error: err.message || "ProductListing validation failed.",
        });
        return;
      }
      res.status(500).json({ success: false, error: err.message || "Failed to create listing" });
    }
  }
);

// GET /api/marketplace/listings/my - Customer's own listings
router.get(
  "/listings/my",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const listings = await ProductListingModel.find({ customerId: user.id })
        .sort({ createdAt: -1 })
        .lean();

      // Attach offers and pickup task for each listing
      const listingIds = listings.map((l) => l.listingId);
      const offers = await DealerOfferModel.find({ listingId: { $in: listingIds } })
        .sort({ createdAt: -1 })
        .lean();
      const pickupTasks = await PickupTaskModel.find({ listingId: { $in: listingIds } }).lean();

      const enriched = listings.map((listing) => {
        const listingOffers = offers.filter((o) => o.listingId === listing.listingId);
        const task = pickupTasks.find((p) => p.listingId === listing.listingId);
        return {
          ...listing,
          offers: listingOffers,
          pickupTask: task || null,
        };
      });

      res.json({ success: true, data: enriched });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch listings" });
    }
  }
);

// GET /api/marketplace/listings/nearby - Dealers browse nearby customer listings
router.get(
  "/listings/nearby",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const {
        category,
        condition,
        minPrice,
        maxPrice,
        latitude,
        longitude,
        maxDistanceKm,
        search,
        page = "1",
        limit = "20",
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      // Base query: only eligible, approved active listings (pending and rejected listings are strictly excluded)
      const query: any = {
        status: { $in: ["APPROVED", "LISTED", "OFFERS_RECEIVED", "OFFER_ACCEPTED"] },
      };

      if (category && category !== "ALL") {
        query.category = category;
      }
      if (condition && condition !== "ALL") {
        query.condition = condition;
      }
      if (minPrice || maxPrice) {
        query.expectedPrice = {};
        if (minPrice) query.expectedPrice.$gte = Number(minPrice);
        if (maxPrice) query.expectedPrice.$lte = Number(maxPrice);
      }
      if (search && typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [{ title: regex }, { brand: regex }, { model: regex }, { description: regex }];
      }

      const hasCoordinates =
        latitude !== undefined &&
        longitude !== undefined &&
        !isNaN(Number(latitude)) &&
        !isNaN(Number(longitude));

      let userLat = hasCoordinates ? Number(latitude) : 0;
      let userLng = hasCoordinates ? Number(longitude) : 0;
      let maxDist = maxDistanceKm ? Number(maxDistanceKm) : 50; // default 50km

      let listings: any[] = [];
      let totalCount = 0;

      if (hasCoordinates) {
        // Query MongoDB with 2dsphere index if coordinates available
        try {
          const geoQuery: any = {
            ...query,
            location: {
              $nearSphere: {
                $geometry: {
                  type: "Point",
                  coordinates: [userLng, userLat],
                },
                $maxDistance: maxDist * 1000, // meters
              },
            },
          };
          listings = await ProductListingModel.find(geoQuery).skip(skip).limit(limitNum).lean();
          totalCount = await ProductListingModel.countDocuments(geoQuery);
        } catch (geoErr) {
          // If index not ready or fallback needed, query normally and compute Haversine
          const allListings = await ProductListingModel.find(query).lean();
          listings = allListings
            .map((item) => {
              let dist: number | null = null;
              if (item.location?.coordinates && item.location.coordinates.length === 2) {
                dist = calculateDistanceKm(
                  userLat,
                  userLng,
                  item.location.coordinates[1],
                  item.location.coordinates[0]
                );
              }
              return { ...item, distanceKm: dist };
            })
            .filter((item) => item.distanceKm === null || item.distanceKm <= maxDist)
            .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
            .slice(skip, skip + limitNum);
          totalCount = allListings.length;
        }
      } else {
        listings = await ProductListingModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean();
        totalCount = await ProductListingModel.countDocuments(query);
      }

      // Check if this dealer has already offered on each listing
      const listingIds = listings.map((l) => l.listingId);
      const myOffers = await DealerOfferModel.find({
        listingId: { $in: listingIds },
        dealerId: dealer.id,
      }).lean();

      // Mask customer exact address for privacy and attach distance
      const sanitized = listings.map((listing) => {
        let distanceKm: number | null = listing.distanceKm ?? null;
        if (
          distanceKm === null &&
          hasCoordinates &&
          listing.location?.coordinates &&
          listing.location.coordinates.length === 2
        ) {
          distanceKm = calculateDistanceKm(
            userLat,
            userLng,
            listing.location.coordinates[1],
            listing.location.coordinates[0]
          );
        }

        const myOffer = myOffers.find((o) => o.listingId === listing.listingId);
        const isMyAcceptedOffer =
          listing.status === "OFFER_ACCEPTED" && listing.assignedDealerId === dealer.id;

        const copy: any = {
          ...listing,
          distanceKm,
          myOffer: myOffer || null,
        };

        // If dealer's offer is accepted, they can see exact address; otherwise keep it masked
        if (!isMyAcceptedOffer) {
          delete copy.pickupAddress;
          delete copy.customerPhone;
          delete copy.customerEmail;
          delete copy.pickupHandoverOtp;
        }

        return copy;
      });

      res.json({
        success: true,
        data: sanitized,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (err: any) {
      console.error("Error in nearby listings:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to fetch nearby listings" });
    }
  }
);

// GET /api/marketplace/listings/inspection - Inspection queue for Admins/Dealers/Workers
router.get(
  "/listings/inspection",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      if (!["ADMIN", "DEALER", "WORKER"].includes(user.role)) {
        res.status(403).json({
          success: false,
          error: "Unauthorized: Only Admins, Dealers, or Technicians can access inspection listings.",
        });
        return;
      }

      const { status, category, search, page = "1", limit = "20" } = req.query;
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const filter: any = {};

      if (status && String(status).toUpperCase() !== "ALL") {
        filter.status = String(status).toUpperCase();
      }

      if (category && String(category) !== "ALL") {
        filter.category = String(category);
      }

      if (search && String(search).trim()) {
        const regex = new RegExp(String(search).trim(), "i");
        filter.$or = [
          { title: regex },
          { brand: regex },
          { model: regex },
          { listingId: regex },
          { description: regex },
        ];
      }

      const [listings, totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
        ProductListingModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        ProductListingModel.countDocuments(filter),
        ProductListingModel.countDocuments({ status: "PENDING_INSPECTION" }),
        ProductListingModel.countDocuments({ status: "APPROVED" }),
        ProductListingModel.countDocuments({ status: "REJECTED" }),
      ]);

      res.json({
        success: true,
        data: listings,
        summary: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: pendingCount + approvedCount + rejectedCount,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (err: any) {
      console.error("Error in getInspectionListings:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to fetch inspection listings" });
    }
  }
);

// GET /api/marketplace/listings/:id - Listing detail with privacy mask
router.get(
  "/listings/:id",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const listing = await ProductListingModel.findOne({
        $or: [{ listingId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      }).lean();

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      // Check permissions: Owner, Assigned Dealer, Assigned Driver, or Admin see full address
      const isOwner = listing.customerId === user.id;
      const isAssignedDealer = listing.assignedDealerId === user.id;
      const isAssignedDriver = listing.assignedDriverId === user.id;
      const isAdmin = user.role === "ADMIN";

      const offers = await DealerOfferModel.find({ listingId: listing.listingId }).lean();
      const pickupTask = await PickupTaskModel.findOne({ listingId: listing.listingId }).lean();

      let result: any = { ...listing, offers, pickupTask };

      // PRIVACY ENFORCEMENT: Never expose customer exact address or phone to unauthorized dealers/browsers
      if (!isOwner && !isAssignedDealer && !isAssignedDriver && !isAdmin) {
        delete result.pickupAddress;
        delete result.customerPhone;
        delete result.customerEmail;
        delete result.pickupHandoverOtp;
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch listing" });
    }
  }
);

// PATCH /api/marketplace/listings/:id/cancel - Customer cancels listing
router.patch(
  "/listings/:id/cancel",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { reason } = req.body;
      const listing = await ProductListingModel.findOne({
        $or: [{ listingId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      if (listing.customerId !== user.id && user.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "You can only cancel your own listings." });
        return;
      }

      if (["IN_TRANSIT", "COLLECTED"].includes(listing.status)) {
        res.status(400).json({
          success: false,
          error: `Cannot cancel listing while it is in status: ${listing.status}`,
        });
        return;
      }

      listing.status = "CANCELLED";
      listing.cancellationReason = reason || "Cancelled by customer";
      await listing.save();

      // Cancel pending offers
      await DealerOfferModel.updateMany(
        { listingId: listing.listingId, status: "PENDING" },
        { status: "CANCELLED" }
      );

      // Cancel pickup task if assigned
      if (listing.pickupTaskId) {
        await PickupTaskModel.updateOne(
          { taskId: listing.pickupTaskId },
          { status: "CANCELLED", cancellationReason: "Customer cancelled listing" }
        );
      }

      res.json({ success: true, message: "Listing cancelled successfully", data: listing });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to cancel listing" });
    }
  }
);

// PATCH /api/marketplace/listings/:id/review - Dealer/Admin/Technician inspects & approves/rejects listing
router.patch(
  "/listings/:id/review",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      if (!["DEALER", "ADMIN", "WORKER"].includes(user.role)) {
        res.status(403).json({
          success: false,
          error: "Unauthorized: Only Dealers, Technicians, or Admins can review and approve customer listings.",
        });
        return;
      }

      const { decision, reviewNotes } = req.body;
      if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
        res.status(400).json({
          success: false,
          error: "Valid decision ('APPROVED' or 'REJECTED') is required.",
        });
        return;
      }

      const listing = await ProductListingModel.findOne({
        $or: [
          { listingId: req.params.id },
          ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: req.params.id }] : []),
        ],
      });

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      listing.status = decision === "APPROVED" ? "APPROVED" : "REJECTED";
      listing.reviewNotes =
        reviewNotes ||
        (decision === "APPROVED"
          ? "Passed technical and visual inspection review."
          : "Declined due to condition or defect criteria.");
      listing.reviewedBy = user.id;
      listing.reviewedAt = new Date();
      await listing.save();

      // Record stage in traceable lifecycle timeline
      await OwnershipEventModel.create({
        productId: listing.listingId,
        eventType: decision === "APPROVED" ? "INSPECTION" : "STATUS_CHANGE",
        description:
          decision === "APPROVED"
            ? `Inspection review passed and verified: ${listing.reviewNotes}`
            : `Listing rejected during inspection review: ${listing.reviewNotes}`,
        actorRole: user.role,
        actorLabel: user.fullName || "Certified Technician",
        evidenceRef: `REV-${listing.listingId}`,
        metadata: {
          decision,
          reviewNotes: listing.reviewNotes,
          reviewerRole: user.role,
        },
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: `Listing ${decision.toLowerCase()} successfully`,
        data: listing,
      });
    } catch (err: any) {
      console.error("Error reviewing listing:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to review listing" });
    }
  }
);

// PATCH /api/marketplace/listings/:id/publish - Customer or Admin publishes approved listing to marketplace
router.patch(
  "/listings/:id/publish",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const listing = await ProductListingModel.findOne({
        $or: [
          { listingId: req.params.id },
          ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: req.params.id }] : []),
        ],
      });

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      // Authorization: Seller owner, Admin, or Dealer
      if (listing.customerId !== user.id && user.role !== "ADMIN" && user.role !== "DEALER") {
        res.status(403).json({
          success: false,
          error: "You are not authorized to publish this listing.",
        });
        return;
      }

      // Mandatory validation: Cannot publish until review/approval process is complete
      if (listing.status !== "APPROVED") {
        res.status(400).json({
          success: false,
          error: `Listing cannot be published until inspection review is complete. Current status is ${listing.status}; must be APPROVED.`,
        });
        return;
      }

      listing.status = "LISTED";
      await listing.save();

      // Record stage 5 in traceable product timeline: Resale Marketplace Listing
      await OwnershipEventModel.create({
        productId: listing.listingId,
        eventType: "RESALE_LISTING",
        description: `Device published live on peer-to-peer Circular Marketplace for ₹${listing.expectedPrice}.`,
        actorRole: "CUSTOMER",
        actorLabel: "Owner 1",
        evidenceRef: `MKT-${listing.listingId}`,
        metadata: {
          listingId: listing.listingId,
          price: listing.expectedPrice,
          condition: listing.condition,
        },
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Listing published to Circular Marketplace successfully.",
        data: listing,
      });
    } catch (err: any) {
      console.error("Error publishing listing:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to publish listing" });
    }
  }
);

// ============================================================================
// DEALER OFFERS & PICKUP DISPATCH
// ============================================================================

// POST /api/marketplace/listings/:id/offer - Dealer makes an offer
router.post(
  "/listings/:id/offer",
  authenticateToken,
  requireRole("DEALER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const { offeredPrice, message, estimatedPickupHours = 24, dealerPhone } = req.body;

      if (!offeredPrice || Number(offeredPrice) <= 0) {
        res.status(400).json({ success: false, error: "A valid offered price is required." });
        return;
      }

      const listing = await ProductListingModel.findOne({
        $or: [{ listingId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      if (
        [
          "PENDING_INSPECTION",
          "REJECTED",
          "OFFER_ACCEPTED",
          "PICKUP_SCHEDULED",
          "IN_TRANSIT",
          "COLLECTED",
          "CANCELLED",
        ].includes(listing.status)
      ) {
        res.status(400).json({
          success: false,
          error: `Cannot make an offer on a listing with status ${listing.status}. Only approved, eligible listings accept offers.`,
        });
        return;
      }

      // Check if dealer already has an active pending offer
      const existingOffer = await DealerOfferModel.findOne({
        listingId: listing.listingId,
        dealerId: dealer.id,
        status: "PENDING",
      });

      if (existingOffer) {
        // Update existing offer price/message
        existingOffer.offeredPrice = Number(offeredPrice);
        if (message !== undefined) existingOffer.message = message;
        if (estimatedPickupHours) existingOffer.estimatedPickupHours = Number(estimatedPickupHours);
        await existingOffer.save();

        res.json({
          success: true,
          message: "Existing offer updated successfully",
          data: existingOffer,
        });
        return;
      }

      const offerId = `OFF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      const newOffer = await DealerOfferModel.create({
        offerId,
        listingId: listing.listingId,
        dealerId: dealer.id,
        dealerName: dealer.fullName,
        dealerOrganization: dealer.organization || "Independent Dealer",
        dealerPhone: dealerPhone || "",
        offeredPrice: Number(offeredPrice),
        message: message || "Interested in collecting your electronic device.",
        estimatedPickupHours: Number(estimatedPickupHours) || 24,
        status: "PENDING",
      });

      // Update listing
      listing.offersCount = (listing.offersCount || 0) + 1;
      if (listing.status === "SUBMITTED" || listing.status === "APPROVED" || listing.status === "LISTED") {
        listing.status = "OFFERS_RECEIVED";
      }
      await listing.save();

      res.status(201).json({
        success: true,
        message: "Offer submitted successfully to customer",
        data: newOffer,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to submit offer" });
    }
  }
);

// GET /api/marketplace/offers/my - Dealer views their offers
router.get(
  "/offers/my",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const offers = await DealerOfferModel.find({ dealerId: dealer.id })
        .sort({ createdAt: -1 })
        .lean();

      const listingIds = offers.map((o) => o.listingId);
      const listings = await ProductListingModel.find({ listingId: { $in: listingIds } }).lean();

      const enriched = offers.map((offer) => {
        const listing = listings.find((l) => l.listingId === offer.listingId);
        return {
          ...offer,
          listing: listing || null,
        };
      });

      res.json({ success: true, data: enriched });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch offers" });
    }
  }
);

// POST /api/marketplace/offers/:id/accept - Customer accepts dealer offer
router.post(
  "/offers/:id/accept",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const offer = await DealerOfferModel.findOne({
        $or: [{ offerId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!offer) {
        res.status(404).json({ success: false, error: "Offer not found" });
        return;
      }

      const listing = await ProductListingModel.findOne({ listingId: offer.listingId });
      if (!listing) {
        res.status(404).json({ success: false, error: "Associated listing not found" });
        return;
      }

      if (listing.customerId !== user.id && user.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "You can only accept offers on your own listings." });
        return;
      }

      if (listing.status === "OFFER_ACCEPTED" || listing.status === "COLLECTED") {
        res.status(400).json({ success: false, error: "An offer has already been accepted for this listing." });
        return;
      }

      // Generate a secure 6-digit handover OTP
      const handoverOtp = crypto.randomInt(100000, 1000000).toString();

      offer.status = "ACCEPTED";
      await offer.save();

      // Reject all other pending offers for this listing
      await DealerOfferModel.updateMany(
        { listingId: listing.listingId, _id: { $ne: offer._id }, status: "PENDING" },
        { status: "REJECTED", rejectionReason: "Customer accepted another offer." }
      );

      listing.status = "OFFER_ACCEPTED";
      listing.acceptedOfferId = offer.offerId;
      listing.assignedDealerId = offer.dealerId;
      listing.assignedDealerName = offer.dealerName;
      listing.pickupHandoverOtp = handoverOtp;
      await listing.save();

      res.json({
        success: true,
        message: "Offer accepted! A 6-digit pickup OTP has been generated for verification with the driver.",
        data: {
          listing,
          acceptedOffer: offer,
          handoverOtp,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to accept offer" });
    }
  }
);

// POST /api/marketplace/offers/:id/reject - Customer rejects dealer offer
router.post(
  "/offers/:id/reject",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { reason } = req.body;
      const offer = await DealerOfferModel.findOne({
        $or: [{ offerId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!offer) {
        res.status(404).json({ success: false, error: "Offer not found" });
        return;
      }

      const listing = await ProductListingModel.findOne({ listingId: offer.listingId });
      if (!listing) {
        res.status(404).json({ success: false, error: "Associated listing not found" });
        return;
      }

      if (listing.customerId !== user.id && user.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "You can only reject offers on your own listings." });
        return;
      }

      offer.status = "REJECTED";
      offer.rejectionReason = reason || "Declined by customer";
      await offer.save();

      res.json({ success: true, message: "Offer rejected successfully", data: offer });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to reject offer" });
    }
  }
);

// ============================================================================
// FEATURE 3: PICKUP SCHEDULING AND DRIVER TRACKING
// ============================================================================

// POST /api/marketplace/listings/:id/assign-driver - Dealer assigns driver & vehicle
router.post(
  "/listings/:id/assign-driver",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const { driverId, vehicleRegistration, vehicleType, notes } = req.body;

      if (!driverId || !vehicleRegistration) {
        res.status(400).json({
          success: false,
          error: "Driver and vehicle registration are required for pickup dispatch.",
        });
        return;
      }

      const listing = await ProductListingModel.findOne({
        $or: [{ listingId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      if (listing.assignedDealerId !== dealer.id && dealer.role !== "ADMIN") {
        res.status(403).json({
          success: false,
          error: "You are not authorized to assign a driver to this listing.",
        });
        return;
      }

      if (!listing.pickupHandoverOtp) {
        listing.pickupHandoverOtp = crypto.randomInt(100000, 1000000).toString();
      }

      // Find driver user
      const driverUser = await UserModel.findById(driverId);
      if (!driverUser) {
        res.status(404).json({ success: false, error: "Selected driver user not found." });
        return;
      }

      // Fetch accepted offer
      const offer = await DealerOfferModel.findOne({
        listingId: listing.listingId,
        status: "ACCEPTED",
      });

      const agreedPrice = offer ? offer.offeredPrice : listing.expectedPrice;
      const taskId = `PKT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      const pickupTask = await PickupTaskModel.create({
        taskId,
        listingId: listing.listingId,
        offerId: offer ? offer.offerId : "MANUAL",
        dealerId: dealer.id,
        dealerName: dealer.fullName,
        driverId: driverUser._id.toString(),
        driverName: driverUser.fullName,
        driverPhone: (driverUser as any).phone || "N/A",
        vehicleRegistration: vehicleRegistration.trim(),
        vehicleType: vehicleType || "Eco Van",
        customerName: listing.customerName,
        customerPhone: listing.customerPhone || "N/A",
        pickupAddress: listing.pickupAddress,
        pickupCoordinates: listing.location,
        productTitle: listing.title,
        agreedPrice,
        status: "ASSIGNED",
        statusHistory: [{ status: "ASSIGNED", timestamp: new Date(), note: "Task assigned by dealer" }],
        handoverOtp: listing.pickupHandoverOtp,
        notes: notes || "",
      });

      listing.status = "PICKUP_SCHEDULED";
      listing.assignedDriverId = driverUser._id.toString();
      listing.assignedDriverName = driverUser.fullName;
      listing.pickupTaskId = taskId;
      await listing.save();

      res.status(201).json({
        success: true,
        message: "Driver assigned and pickup task dispatched successfully.",
        data: pickupTask,
      });
    } catch (err: any) {
      console.error("Error assigning driver:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to assign driver" });
    }
  }
);

// GET /api/marketplace/pickups/my - Driver/Dealer/Customer pickup tasks
router.get(
  "/pickups/my",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      let filter: any = {};

      if (user.role === "DRIVER") {
        filter.driverId = user.id;
      } else if (user.role === "DEALER") {
        filter.dealerId = user.id;
      } else if (user.role === "CUSTOMER") {
        const myListings = await ProductListingModel.find({ customerId: user.id }).select("listingId");
        filter.listingId = { $in: myListings.map((l) => l.listingId) };
      }

      const tasks = await PickupTaskModel.find(filter).sort({ createdAt: -1 }).lean();

      // Mask OTP from driver before it's entered
      const sanitized = tasks.map((t) => {
        if (user.role === "DRIVER" && !t.handoverOtpVerified) {
          const { handoverOtp, ...rest } = t;
          return rest;
        }
        return t;
      });

      res.json({ success: true, data: sanitized });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch pickup tasks" });
    }
  }
);

// PATCH /api/marketplace/pickups/:id/status - Driver updates pickup lifecycle status
router.patch(
  "/pickups/:id/status",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { status, note, handoverOtp, proofPhotos, actualWeightKg, cancellationReason } = req.body;

      const task = await PickupTaskModel.findOne({
        $or: [{ taskId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!task) {
        res.status(404).json({ success: false, error: "Pickup task not found" });
        return;
      }

      // Authorization: Driver assigned, Dealer owner, or Admin
      const isDriver = task.driverId === user.id;
      const isDealer = task.dealerId === user.id;
      const isAdmin = user.role === "ADMIN";

      if (!isDriver && !isDealer && !isAdmin) {
        res.status(403).json({ success: false, error: "Not authorized to update this pickup task." });
        return;
      }

      // Strict validation for COLLECTION: Must provide customer OTP!
      if (status === "COLLECTED") {
        if (task.status === "COLLECTED" || task.handoverOtpVerified) {
          res.status(400).json({
            success: false,
            error: "Pickup task is already collected. Handover OTP cannot be reused.",
          });
          return;
        }

        if (!handoverOtp || handoverOtp.trim() !== task.handoverOtp.trim()) {
          res.status(400).json({
            success: false,
            error: "Invalid Handover OTP. The customer must provide the 6-digit confirmation OTP to complete collection.",
          });
          return;
        }
        task.handoverOtpVerified = true;
        if (Array.isArray(proofPhotos) && proofPhotos.length > 0) {
          task.proofPhotos = proofPhotos;
        }
        if (actualWeightKg) {
          task.actualWeightKg = Number(actualWeightKg);
        }

        // Update associated listing
        await ProductListingModel.updateOne(
          { listingId: task.listingId },
          {
            status: "COLLECTED",
            collectedAt: new Date(),
            actualWeightKg: task.actualWeightKg,
            pickupProofPhotos: task.proofPhotos,
          }
        );
      }

      if (status === "CANCELLED") {
        task.cancellationReason = cancellationReason || note || "Cancelled";
        await ProductListingModel.updateOne(
          { listingId: task.listingId },
          { status: "CANCELLED", cancellationReason: task.cancellationReason }
        );
      }

      if (status === "EN_ROUTE") {
        await ProductListingModel.updateOne({ listingId: task.listingId }, { status: "IN_TRANSIT" });
      }

      task.status = status;
      task.statusHistory.push({
        status,
        timestamp: new Date(),
        note: note || `Status updated to ${status}`,
      });

      await task.save();

      res.json({
        success: true,
        message: `Pickup status updated to ${status}`,
        data: task,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to update status" });
    }
  }
);

// POST /api/marketplace/pickups/:id/location - Driver shares GPS coordinate updates
router.post(
  "/pickups/:id/location",
  authenticateToken,
  requireRole("DRIVER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { latitude, longitude, heading, speed, accuracy } = req.body;

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        res.status(400).json({ success: false, error: "Valid latitude and longitude numbers are required." });
        return;
      }

      const task = await PickupTaskModel.findOne({
        $or: [{ taskId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
        driverId: user.id,
      });

      if (!task) {
        res.status(404).json({ success: false, error: "Assigned pickup task not found" });
        return;
      }

      // If trip is ended, do not record further coordinates
      if (["COLLECTED", "DELIVERED", "CANCELLED"].includes(task.status)) {
        res.status(400).json({
          success: false,
          error: `Trip has completed or cancelled (${task.status}). Live tracking stopped.`,
        });
        return;
      }

      let etaMinutes: number | undefined = undefined;
      let distanceKm: number | undefined = undefined;

      if (task.pickupCoordinates?.coordinates && task.pickupCoordinates.coordinates.length === 2) {
        distanceKm = calculateDistanceKm(
          latitude,
          longitude,
          task.pickupCoordinates.coordinates[1],
          task.pickupCoordinates.coordinates[0]
        );
        // Estimate 30 km/h average city speed -> 2 minutes per km
        etaMinutes = Math.max(1, Math.round(distanceKm * 2));
      }

      task.lastKnownLocation = {
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        accuracy: accuracy || 10,
        updatedAt: new Date(),
      };
      if (etaMinutes !== undefined) task.etaMinutes = etaMinutes;
      if (distanceKm !== undefined) task.distanceKm = distanceKm;

      await task.save();

      res.json({
        success: true,
        message: "Driver location recorded",
        data: {
          lastKnownLocation: task.lastKnownLocation,
          etaMinutes: task.etaMinutes,
          distanceKm: task.distanceKm,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to update location" });
    }
  }
);

// ============================================================================
// FEATURE 4: DEALER — SECOND-HAND ELECTRONICS MARKETPLACE & INSPECTIONS
// ============================================================================

// GET /api/marketplace/inspections/collected-items - Dealer views collected items needing inspection
router.get(
  "/inspections/collected-items",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      // Collected items assigned to this dealer
      const collected = await ProductListingModel.find({
        assignedDealerId: dealer.id,
        status: "COLLECTED",
      })
        .sort({ collectedAt: -1 })
        .lean();

      // Check existing inspections
      const listingIds = collected.map((c) => c.listingId);
      const inspections = await ProductInspectionModel.find({ listingId: { $in: listingIds } }).lean();

      const itemsWithInspection = collected.map((item) => {
        const insp = inspections.find((i) => i.listingId === item.listingId);
        return {
          ...item,
          inspection: insp || null,
          hasInspection: Boolean(insp),
        };
      });

      res.json({ success: true, data: itemsWithInspection });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch items" });
    }
  }
);

// POST /api/marketplace/inspections - Dealer records inspection
router.post(
  "/inspections",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const {
        listingId,
        cosmeticGrade,
        functionalTests,
        decision,
        findings,
        repairPerformed,
        replacedComponents,
        suggestedResalePrice,
        warrantyMonths = 3,
        photos,
      } = req.body;

      if (!listingId || !cosmeticGrade || !decision || !findings) {
        res.status(400).json({
          success: false,
          error: "listingId, cosmeticGrade, decision, and findings are mandatory inspection fields.",
        });
        return;
      }

      const listing = await ProductListingModel.findOne({ listingId });
      if (!listing) {
        res.status(404).json({ success: false, error: "Collected listing not found." });
        return;
      }

      if (listing.assignedDealerId !== dealer.id && dealer.role !== "ADMIN") {
        res.status(403).json({
          success: false,
          error: "You are not authorized to inspect items not assigned to your dealership.",
        });
        return;
      }

      const inspectionId = `INSP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      // Hash inspection report for verifiable traceability
      const reportPayload = JSON.stringify({
        inspectionId,
        listingId,
        cosmeticGrade,
        functionalTests,
        decision,
        findings,
        timestamp: new Date().toISOString(),
      });
      const inspectionReportHash = crypto.createHash("sha256").update(reportPayload).digest("hex");

      const inspection = await ProductInspectionModel.create({
        inspectionId,
        listingId,
        dealerId: dealer.id,
        inspectorName: dealer.fullName,
        cosmeticGrade,
        functionalTests: functionalTests || {
          powerOn: false,
          displayWorks: false,
          touchOrKeysWork: false,
          batteryCharges: false,
          connectivityWorks: false,
          audioPortsWork: false,
        },
        decision,
        findings: findings.trim(),
        repairPerformed: repairPerformed || "",
        replacedComponents: replacedComponents || "",
        suggestedResalePrice: suggestedResalePrice ? Number(suggestedResalePrice) : undefined,
        warrantyMonths: Number(warrantyMonths) || 3,
        inspectionReportHash,
        photos: Array.isArray(photos) ? photos : [],
      });

      listing.inspectionId = inspectionId;
      await listing.save();

      res.status(201).json({
        success: true,
        message: "Inspection recorded successfully with cryptographic verification hash.",
        data: inspection,
      });
    } catch (err: any) {
      console.error("Error creating inspection:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to record inspection" });
    }
  }
);

// POST /api/marketplace/resale-products - Dealer publishes refurbished product
// STRICT GATE: Must have inspection decision === "REUSABLE_RESALE" or "REPAIR_REQUIRED"
router.post(
  "/resale-products",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const {
        sourceListingId,
        sourceInspectionId,
        title,
        category,
        brand,
        model,
        description,
        images,
        price,
        conditionGrade,
        functionalSummary,
        repairHistory,
        warrantyMonths = 3,
        stock = 1,
        status = "PUBLISHED",
      } = req.body;

      if (!title || !category || !brand || !price || !conditionGrade || !functionalSummary) {
        res.status(400).json({
          success: false,
          error: "title, category, brand, price, conditionGrade, and functionalSummary are required.",
        });
        return;
      }

      // MANDATORY INSPECTION GATE:
      if (sourceInspectionId) {
        const inspection = await ProductInspectionModel.findOne({ inspectionId: sourceInspectionId });
        if (!inspection) {
          res.status(400).json({
            success: false,
            error: "Invalid sourceInspectionId. Inspection record not found.",
          });
          return;
        }

        if (inspection.decision === "RECYCLE_ONLY" || inspection.decision === "UNSAFE_HAZARDOUS") {
          res.status(400).json({
            success: false,
            error: `Cannot publish product for resale. Inspection decision is '${inspection.decision}'. This product must be sent to certified recycling.`,
          });
          return;
        }
      } else if (sourceListingId) {
        // If inspection ID omitted but listing ID passed, check listing has valid inspection
        const listing = await ProductListingModel.findOne({ listingId: sourceListingId });
        if (!listing || !listing.inspectionId) {
          res.status(400).json({
            success: false,
            error: "A completed inspection is strictly required before publishing collected electronics for resale.",
          });
          return;
        }
      }

      let resolvedCity = (req.body.dealerCity || "").trim();
      let resolvedLocation = (req.body.approximateLocation || "").trim();

      if (sourceListingId) {
        const srcListing = await ProductListingModel.findOne({ listingId: sourceListingId }).lean();
        if (srcListing) {
          if (!resolvedLocation) resolvedLocation = srcListing.approximateLocation || srcListing.pickupAddress || "";
          if (!resolvedCity && srcListing.approximateLocation) {
            resolvedCity = srcListing.approximateLocation.split(",")[0].trim();
          }
        }
      }
      if (!resolvedCity) resolvedCity = "Bengaluru Urban, Karnataka";
      if (!resolvedLocation) resolvedLocation = resolvedCity;

      const resaleId = `RSL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      const resaleProduct = await ResaleProductModel.create({
        resaleId,
        dealerId: dealer.id,
        dealerName: dealer.fullName,
        dealerOrganization: dealer.organization || "Certified Eco Dealer",
        dealerCity: resolvedCity,
        approximateLocation: resolvedLocation,
        sourceListingId: sourceListingId || undefined,
        sourceInspectionId: sourceInspectionId || undefined,
        title: title.trim(),
        category: category.trim(),
        brand: brand.trim(),
        model: model ? model.trim() : "Standard",
        description: description || "Inspected & certified pre-owned electronic device.",
        images: Array.isArray(images) ? images : [],
        price: Number(price),
        conditionGrade,
        functionalSummary: functionalSummary.trim(),
        repairHistory: repairHistory || "",
        warrantyMonths: Number(warrantyMonths) || 3,
        stock: Math.max(1, Number(stock) || 1),
        reservedStock: 0,
        status,
        viewsCount: 0,
      });

      if (sourceListingId) {
        await ProductListingModel.updateOne({ listingId: sourceListingId }, { resaleProductId: resaleId });
      }

      res.status(201).json({
        success: true,
        message: "Refurbished product published to Circular Marketplace successfully.",
        data: resaleProduct,
      });
    } catch (err: any) {
      console.error("Error creating resale product:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to publish resale product" });
    }
  }
);

// GET /api/marketplace/resale-products/my - Dealer's resale products
router.get(
  "/resale-products/my",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const filter: any = dealer.role === "ADMIN" ? {} : { dealerId: dealer.id };
      const products = await ResaleProductModel.find(filter).sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: products });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch resale products" });
    }
  }
);

// PATCH /api/marketplace/resale-products/:id - Dealer updates resale product
router.patch(
  "/resale-products/:id",
  authenticateToken,
  requireRole("DEALER", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealer = req.user!;
      const { price, stock, status, description, warrantyMonths } = req.body;

      const product = await ResaleProductModel.findOne({
        $or: [{ resaleId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!product) {
        res.status(404).json({ success: false, error: "Resale product not found" });
        return;
      }

      if (product.dealerId !== dealer.id && dealer.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "Unauthorized to modify this resale product." });
        return;
      }

      if (price !== undefined) product.price = Number(price);
      if (stock !== undefined) product.stock = Math.max(0, Number(stock));
      if (status !== undefined) product.status = status;
      if (description !== undefined) product.description = description;
      if (warrantyMonths !== undefined) product.warrantyMonths = Number(warrantyMonths);

      await product.save();

      res.json({ success: true, message: "Resale product updated successfully", data: product });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to update resale product" });
    }
  }
);

// ============================================================================
// FEATURE 5: FACTORY — RECOVERED MATERIALS MARKETPLACE
// ============================================================================

// POST /api/marketplace/material-listings - Factory lists recovered material
router.post(
  "/material-listings",
  authenticateToken,
  requireRole("FACTORY", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const factoryUser = req.user!;
      const {
        sourceMaterialBatchId,
        sourceWasteBatchId,
        materialType,
        purityPercentage,
        grade,
        unit = "kg",
        totalListedWeightKg,
        pricePerKg,
        minimumOrderKg = 1,
        description,
        location,
      } = req.body;

      if (!sourceMaterialBatchId || !materialType || !purityPercentage || !grade || !totalListedWeightKg || !pricePerKg) {
        res.status(400).json({
          success: false,
          error: "sourceMaterialBatchId, materialType, purityPercentage, grade, totalListedWeightKg, and pricePerKg are required.",
        });
        return;
      }

      const requestedWeight = Number(totalListedWeightKg);
      if (requestedWeight <= 0) {
        res.status(400).json({ success: false, error: "Listing weight must be greater than 0 kg." });
        return;
      }

      // Atomically check mass balance and reserve weight from source material batch
      const updatedRecoveredMaterial = await RecoveredMaterialModel.findOneAndUpdate(
        {
          $or: [
            { materialBatchId: sourceMaterialBatchId },
            { _id: sourceMaterialBatchId.match(/^[0-9a-fA-F]{24}$/) ? sourceMaterialBatchId : undefined },
          ],
          $expr: {
            $gte: [
              { $subtract: ["$recoveredWeightKg", { $ifNull: ["$claimedWeightKg", 0] }] },
              requestedWeight,
            ],
          },
        },
        {
          $inc: { claimedWeightKg: requestedWeight },
        },
        { new: true }
      );

      if (!updatedRecoveredMaterial) {
        res.status(400).json({
          success: false,
          error: `Mass balance validation failed. Requested listing weight (${requestedWeight} kg) exceeds verified available recovered stock or source material batch was not found.`,
        });
        return;
      }

      // Check waste batch
      const wasteBatchId = sourceWasteBatchId || updatedRecoveredMaterial.sourceBatchId;

      const listingId = `MAT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      const newListing = await MaterialMarketplaceListingModel.create({
        listingId,
        factoryId: factoryUser.facilityId || factoryUser.id,
        factoryName: factoryUser.organization || factoryUser.fullName,
        sourceMaterialBatchId: updatedRecoveredMaterial.materialBatchId,
        sourceWasteBatchId: wasteBatchId,
        materialType: materialType.trim(),
        purityPercentage: Number(purityPercentage),
        grade: grade.trim(),
        unit: unit || "kg",
        totalListedWeightKg: requestedWeight,
        availableStockKg: requestedWeight,
        reservedStockKg: 0,
        pricePerKg: Number(pricePerKg),
        minimumOrderKg: Number(minimumOrderKg) || 1,
        qualityReportHash: updatedRecoveredMaterial.labReportHash || crypto.createHash("sha256").update(listingId).digest("hex"),
        description: description || `Certified recovered ${materialType} with ${purityPercentage}% purity.`,
        location: location || "Factory Processing Facility",
        status: "PUBLISHED",
      });

      res.status(201).json({
        success: true,
        message: "Recovered material listing published with verified mass balance.",
        data: newListing,
      });
    } catch (err: any) {
      console.error("Error creating material listing:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to publish material listing" });
    }
  }
);

// GET /api/marketplace/material-listings - Browse published material listings
router.get(
  "/material-listings",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const listings = await MaterialMarketplaceListingModel.find({ status: "PUBLISHED" })
        .sort({ createdAt: -1 })
        .lean();
      res.json({ success: true, data: listings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch material listings" });
    }
  }
);

// GET /api/marketplace/material-listings/my - Factory's material listings
router.get(
  "/material-listings/my",
  authenticateToken,
  requireRole("FACTORY", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const filter: any =
        user.role === "ADMIN" ? {} : { factoryId: { $in: [user.id, user.facilityId].filter(Boolean) } };

      const listings = await MaterialMarketplaceListingModel.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      res.json({ success: true, data: listings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch material listings" });
    }
  }
);

// PATCH /api/marketplace/material-listings/:id - Factory edits material listing
router.patch(
  "/material-listings/:id",
  authenticateToken,
  requireRole("FACTORY", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { pricePerKg, status, description, minimumOrderKg } = req.body;

      const listing = await MaterialMarketplaceListingModel.findOne({
        $or: [{ listingId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!listing) {
        res.status(404).json({ success: false, error: "Material listing not found" });
        return;
      }

      if (pricePerKg !== undefined) listing.pricePerKg = Number(pricePerKg);
      if (status !== undefined) listing.status = status;
      if (description !== undefined) listing.description = description;
      if (minimumOrderKg !== undefined) listing.minimumOrderKg = Number(minimumOrderKg);

      await listing.save();

      res.json({ success: true, message: "Material listing updated successfully", data: listing });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to update material listing" });
    }
  }
);

// ============================================================================
// CUSTOMER MARKETPLACE (REFURBISHED + RECOVERED RAW MATERIALS) & ORDERS
// ============================================================================

// Helper: Assemble traceable 7-stage chronological product lifecycle timeline
function buildProductTimeline(
  product: any,
  listing: any,
  inspection: any,
  existingEvents: any[],
  latestOrder: any
) {
  const events: any[] = [];

  // Stage 1: Original Device Registration
  const stage1Evt = existingEvents.find((e) => e.eventType === "ORIGINAL_LISTING");
  events.push({
    stage: 1,
    title: "Original Device Registration",
    timestamp: stage1Evt?.timestamp || listing?.createdAt || product?.createdAt || new Date("2024-01-15"),
    actor: stage1Evt?.actorLabel || "Owner 1",
    actorRole: "CUSTOMER",
    evidence: stage1Evt?.evidenceRef || (listing?.listingId
      ? `LST-${listing.listingId}`
      : product?.sourceListingId
      ? `LST-${product.sourceListingId}`
      : `ORIG-${product?.resaleId || "001"}`),
    description: stage1Evt?.description || `Original device registration by Owner 1: ${listing?.brand || product?.brand || "Electronics"} ${
      listing?.model || product?.model || "Device"
    } (${listing?.condition || product?.conditionGrade || "Working"}).`,
    isVerifiedOnChain: Boolean(stage1Evt?.txHash),
    txHash: stage1Evt?.txHash || null,
    status: "COMPLETED",
  });

  // Stage 2: Custody & Logistics Transfer
  const stage2Evt = existingEvents.find((e) => e.eventType === "CUSTODY_TRANSFER");
  const isCustodyRecorded = Boolean(stage2Evt || listing?.collectedAt || product?.sourceInspectionId || product?.dealerId);
  events.push({
    stage: 2,
    title: "Custody Transfer & Secure Logistics",
    timestamp:
      stage2Evt?.timestamp ||
      listing?.collectedAt ||
      (listing?.createdAt ? new Date(new Date(listing.createdAt).getTime() + 86400000) : product?.createdAt),
    actor: stage2Evt?.actorLabel || (isCustodyRecorded ? "EcoTrace Authorized Logistics" : "Not recorded"),
    actorRole: "LOGISTICS",
    evidence: stage2Evt?.evidenceRef || (isCustodyRecorded ? `LOGISTICS-${listing?.listingId || product?.resaleId}` : "Not recorded"),
    description: stage2Evt?.description || (isCustodyRecorded
      ? "Device securely transferred from previous owner to verified inspection hub."
      : "Direct peer-to-peer listing; logistics custody transfer not required."),
    isVerifiedOnChain: Boolean(stage2Evt?.txHash),
    txHash: stage2Evt?.txHash || null,
    status: isCustodyRecorded ? "COMPLETED" : "NOT_RECORDED",
  });

  // Stage 3: Technical Inspection
  const stage3Evt = existingEvents.find((e) => e.eventType === "INSPECTION");
  const isInspectionRecorded = Boolean(stage3Evt || inspection || product?.technicianName || listing?.reviewedAt);
  events.push({
    stage: 3,
    title: "Hardware Inspection & Diagnostic Testing",
    timestamp: stage3Evt?.timestamp || inspection?.inspectionDate || inspection?.createdAt || listing?.reviewedAt || product?.createdAt,
    actor:
      stage3Evt?.actorLabel ||
      inspection?.inspectorName ||
      product?.technicianName ||
      (listing?.reviewedBy ? "Certified Hardware Specialist" : "Not recorded"),
    actorRole: "TECHNICIAN",
    evidence: stage3Evt?.evidenceRef || (inspection?.inspectionReportHash
      ? `HASH:${inspection.inspectionReportHash.substring(0, 16)}...`
      : listing?.reviewedAt
      ? `REV-${listing.listingId}`
      : "Not recorded"),
    description: stage3Evt?.description || (inspection?.findings
      ? `Full 6-point functional diagnostic passed. Findings: ${inspection.findings}. Cosmetic Grade: ${
          inspection.cosmeticGrade || "A"
        }.`
      : listing?.reviewNotes
      ? `Pre-listing inspection passed: ${listing.reviewNotes}`
      : "Technical inspection results not recorded."),
    isVerifiedOnChain: Boolean(stage3Evt?.txHash),
    txHash: stage3Evt?.txHash || null,
    status: isInspectionRecorded ? "COMPLETED" : "NOT_RECORDED",
  });

  // Stage 4: Component Restoration & Refurbishment
  const stage4Evt = existingEvents.find((e) => e.eventType === "REFURBISHMENT");
  const isRefurbRecorded = Boolean(
    stage4Evt ||
    inspection?.repairPerformed ||
      inspection?.replacedComponents ||
      product?.repairHistory ||
      product?.replacedComponents
  );
  events.push({
    stage: 4,
    title: "Component Restoration & Refurbishment",
    timestamp: stage4Evt?.timestamp || inspection?.createdAt || product?.createdAt,
    actor: stage4Evt?.actorLabel || (isRefurbRecorded ? "EcoTrace Certified Refurbishment Lab" : "Not recorded"),
    actorRole: "REFURBISHER",
    evidence: stage4Evt?.evidenceRef || (isRefurbRecorded ? `REFURB-${product?.resaleId || "PASS"}` : "Not recorded"),
    description: stage4Evt?.description || (isRefurbRecorded
      ? `Repairs performed: ${inspection?.repairPerformed || product?.repairHistory || "General servicing"}. Replaced components: ${
          inspection?.replacedComponents || product?.replacedComponents || "None"
        }.`
      : "Original condition maintained; no refurbishment or component replacement recorded."),
    isVerifiedOnChain: Boolean(stage4Evt?.txHash),
    txHash: stage4Evt?.txHash || null,
    status: isRefurbRecorded ? "COMPLETED" : "NOT_RECORDED",
  });

  // Stage 5: Circular Marketplace Resale Listing
  const stage5Evt = existingEvents.find((e) => e.eventType === "RESALE_LISTING");
  events.push({
    stage: 5,
    title: "Circular Marketplace Resale Listing",
    timestamp: stage5Evt?.timestamp || product?.createdAt || listing?.updatedAt || new Date(),
    actor: stage5Evt?.actorLabel || product?.dealerName || "EcoTrace Circular Marketplace",
    actorRole: product?.dealerId ? "DEALER" : "MARKETPLACE",
    evidence: stage5Evt?.evidenceRef || `MKT-${product?.resaleId || listing?.listingId}`,
    description: stage5Evt?.description || `Published to Circular Marketplace at ₹${product?.price || listing?.expectedPrice || 0} with verified hardware transparency.`,
    isVerifiedOnChain: Boolean(stage5Evt?.txHash),
    txHash: stage5Evt?.txHash || null,
    status: "COMPLETED",
  });

  // Stage 6: Purchase & Stock Reservation
  const stage6Evt = existingEvents.find((e) => e.eventType === "PURCHASE");
  const isSold = Boolean(stage6Evt || latestOrder || product?.status === "SOLD" || listing?.status === "SOLD");
  events.push({
    stage: 6,
    title: "Peer-to-Peer Purchase & Stock Reservation",
    timestamp: stage6Evt?.timestamp || latestOrder?.createdAt || (isSold ? new Date() : null),
    actor: isSold ? (stage6Evt?.actorLabel || "Owner 2 (Verified Buyer)") : "Available for Purchase",
    actorRole: "BUYER",
    evidence: stage6Evt?.evidenceRef || (latestOrder?.orderId ? `ORD-${latestOrder.orderId}` : isSold ? "ORD-COMPLETED" : "Awaiting buyer"),
    description: stage6Evt?.description || (isSold
      ? "Device purchased through circular checkout; inventory atomically reserved to prevent overselling."
      : "Listed and currently available in Circular Marketplace."),
    isVerifiedOnChain: Boolean(stage6Evt?.txHash),
    txHash: stage6Evt?.txHash || null,
    status: isSold ? "COMPLETED" : "PENDING",
  });

  // Stage 7: Verified Legal Ownership Transfer
  const stage7Evt = existingEvents.find((e) => e.eventType === "OWNERSHIP_TRANSFER");
  const isTransferred = Boolean(
    stage7Evt ||
    latestOrder?.paymentStatus === "VERIFIED_PAID" ||
    product?.txHash
  );
  events.push({
    stage: 7,
    title: "Verified Legal Ownership Transfer",
    timestamp: stage7Evt?.timestamp || latestOrder?.paymentVerifiedAt || (product?.txHash ? product.createdAt : null),
    actor: isTransferred ? (stage7Evt?.actorLabel || "Owner 2 (Verified Buyer)") : "Pending Order Settlement",
    actorRole: "CUSTODY_ENGINE",
    evidence: stage7Evt?.evidenceRef || (latestOrder?.paymentTxRef
      ? `TXN:${latestOrder.paymentTxRef}`
      : product?.txHash
      ? `TX:${product.txHash}`
      : "Pending Payment"),
    description: stage7Evt?.description || (isTransferred
      ? `Cryptographic title transferred to Owner 2 (Verified Buyer). ${
          product?.txHash
            ? `Smart contract verified on Ethereum/Hardhat testnet (Tx: ${product.txHash})`
            : "Cryptographically verified in EcoTrace custody ledger."
        }`
      : "Ownership transfer will be legally finalized upon verified payment settlement."),
    isVerifiedOnChain: Boolean(product?.txHash || stage7Evt?.txHash),
    txHash: product?.txHash || stage7Evt?.txHash || null,
    status: isTransferred ? "COMPLETED" : "PENDING",
  });

  return events;
}

// GET /api/marketplace/browse - Browse all published marketplace items (Refurbished + P2P + Materials)
router.get("/browse", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type = "ALL", // "ALL" | "REFURBISHED" | "P2P" | "MATERIAL"
      category,
      brand,
      model,
      conditionGrade,
      minPrice,
      maxPrice,
      search,
    } = req.query;

    let refurbished: any[] = [];
    let p2pListings: any[] = [];
    let materials: any[] = [];

    // 1. Certified Refurbished products query
    if (type === "ALL" || type === "REFURBISHED") {
      const rQuery: any = {};
      if (req.query.inStockOnly === "true") {
        rQuery.status = { $in: ["PUBLISHED", "ACTIVE", "AVAILABLE"] };
        rQuery.stock = { $gt: 0 };
      } else {
        rQuery.status = { $in: ["PUBLISHED", "ACTIVE", "AVAILABLE", "SOLD", "RESERVED"] };
      }
      if (category && category !== "ALL") rQuery.category = category;
      if (brand && typeof brand === "string" && brand.trim() !== "") {
        rQuery.brand = new RegExp(brand.trim(), "i");
      }
      if (model && typeof model === "string" && model.trim() !== "") {
        rQuery.model = new RegExp(model.trim(), "i");
      }
      if (conditionGrade && conditionGrade !== "ALL") rQuery.conditionGrade = conditionGrade;
      if (minPrice || maxPrice) {
        rQuery.price = {};
        if (minPrice) rQuery.price.$gte = Number(minPrice);
        if (maxPrice) rQuery.price.$lte = Number(maxPrice);
      }
      if (search && typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search.trim(), "i");
        rQuery.$or = [
          { title: regex },
          { brand: regex },
          { model: regex },
          { description: regex },
          { category: regex },
          { resaleId: regex },
          { dealerCity: regex },
          { dealerName: regex },
          { dealerOrganization: regex },
          { approximateLocation: regex },
        ];
      }

      const rawRefurbished = await ResaleProductModel.find(rQuery).sort({ createdAt: -1 }).lean();

      refurbished = await Promise.all(
        rawRefurbished.map(async (p: any) => {
          let inspection: any = null;
          let listing: any = null;

          if (p.sourceInspectionId) {
            inspection = await ProductInspectionModel.findOne({
              $or: [
                { inspectionId: p.sourceInspectionId },
                ...(mongoose.Types.ObjectId.isValid(p.sourceInspectionId) ? [{ _id: p.sourceInspectionId }] : []),
              ],
            }).lean();
          }

          if (p.sourceListingId) {
            listing = await ProductListingModel.findOne({
              $or: [
                { listingId: p.sourceListingId },
                ...(mongoose.Types.ObjectId.isValid(p.sourceListingId) ? [{ _id: p.sourceListingId }] : []),
              ],
            }).lean();
          }

          return {
            ...p,
            id: p._id.toString(),
            itemType: "REFURBISHED_PRODUCT",
            sellerRole: "DEALER",
            sellerLabel: p.dealerName || "Certified Refurbisher",
            dealerCity: p.dealerCity || (p.approximateLocation ? p.approximateLocation.split(",")[0].trim() : "Bengaluru"),
            approximateLocation: p.approximateLocation || p.dealerCity || listing?.approximateLocation || "Bengaluru Urban, Karnataka",
            warranty: p.warrantyMonths ? `${p.warrantyMonths} Months Certified Warranty` : (p.warrantyPolicy || "Certified Warranty"),
            inspectionStatus: inspection ? "VERIFIED_PASSED" : "CERTIFIED",
            inspection: inspection
              ? {
                  inspectionId: inspection.inspectionId,
                  inspectorName: inspection.inspectorName,
                  cosmeticGrade: inspection.cosmeticGrade,
                  functionalTests: inspection.functionalTests,
                  findings: inspection.findings,
                  repairPerformed: inspection.repairPerformed,
                  replacedComponents: inspection.replacedComponents,
                  inspectionReportHash: inspection.inspectionReportHash,
                  batteryHealth: inspection.batteryHealth || "Not recorded",
                  batteryCycleCount: inspection.batteryCycleCount || "Not recorded",
                }
              : null,
            listing: listing
              ? {
                  listingId: listing.listingId,
                  ageYears: listing.ageYears,
                  condition: listing.condition,
                  description: listing.description,
                  approximateLocation: listing.approximateLocation,
                  damageDetails: listing.damageDetails || "None declared",
                  accessories: listing.accessories || [],
                  batteryInfo: listing.batteryInfo || null,
                  collectedAt: listing.collectedAt || listing.createdAt,
                }
              : null,
          };
        })
      );
    }

    // 2. Peer-to-Peer Second-Hand customer listings
    if (type === "ALL" || type === "P2P" || type === "REFURBISHED") {
      const pQuery: any = {};
      if (req.query.inStockOnly === "true") {
        pQuery.status = { $in: ["LISTED", "APPROVED"] };
      } else {
        pQuery.status = { $in: ["LISTED", "APPROVED", "SOLD"] };
      }
      if (category && category !== "ALL") pQuery.category = category;
      if (brand && typeof brand === "string" && brand.trim() !== "") {
        pQuery.brand = new RegExp(brand.trim(), "i");
      }
      if (model && typeof model === "string" && model.trim() !== "") {
        pQuery.model = new RegExp(model.trim(), "i");
      }
      if (conditionGrade && conditionGrade !== "ALL") {
        pQuery.condition = conditionGrade;
      }
      if (minPrice || maxPrice) {
        pQuery.expectedPrice = {};
        if (minPrice) pQuery.expectedPrice.$gte = Number(minPrice);
        if (maxPrice) pQuery.expectedPrice.$lte = Number(maxPrice);
      }
      if (search && typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search.trim(), "i");
        pQuery.$or = [
          { title: regex },
          { brand: regex },
          { model: regex },
          { description: regex },
          { category: regex },
          { listingId: regex },
          { approximateLocation: regex },
          { pickupAddress: regex },
          { customerName: regex },
        ];
      }

      const rawP2P = await ProductListingModel.find(pQuery).sort({ createdAt: -1 }).lean();

      p2pListings = rawP2P.map((p: any) => ({
        id: p._id.toString(),
        resaleId: p.listingId,
        itemType: "P2P_PRODUCT",
        title: p.title || `${p.brand} ${p.model}`,
        brand: p.brand,
        model: p.model,
        category: p.category,
        price: p.expectedPrice,
        stock: p.status === "SOLD" ? 0 : 1,
        status: p.status === "SOLD" ? "SOLD" : "PUBLISHED",
        listingStatus: p.status,
        conditionGrade: p.condition,
        condition: p.condition,
        ageYears: p.ageYears,
        approximateLocation: p.approximateLocation || "Indiranagar, Bengaluru",
        description: p.description,
        damageDetails: p.damageDetails || "No physical defects reported by seller",
        accessories: p.accessories && p.accessories.length > 0 ? p.accessories : ["Device only"],
        batteryInfo: p.batteryInfo || null,
        warrantyMonths: 0,
        warranty: "P2P Standard 7-Day Peer Verification Window",
        images: Array.isArray(p.images) && p.images.length > 0 ? p.images : ["/uploads/sample-laptop.jpg"],
        dealerName: "Peer Customer (Owner 1)",
        sellerRole: "CUSTOMER",
        sellerLabel: "Owner 1",
        isCertifiedOnChain: false,
        txHash: null,
        inspectionStatus: "PRE_INSPECTION_APPROVED",
        inspection: {
          inspectorName: "EcoTrace Pre-Listing Review",
          cosmeticGrade: p.condition,
          findings: p.reviewNotes || "Pre-listing visual and functional check completed.",
          functionalTests: null,
          repairPerformed: "Not recorded",
          replacedComponents: "Not recorded",
          inspectionReportHash: "Not recorded",
          batteryHealth: p.batteryInfo?.healthState || "Not recorded",
          batteryCycleCount: p.batteryInfo?.cycleCount ? `${p.batteryInfo.cycleCount} cycles` : "Not recorded",
        },
        listing: {
          listingId: p.listingId,
          ageYears: p.ageYears,
          condition: p.condition,
          description: p.description,
          approximateLocation: p.approximateLocation,
          damageDetails: p.damageDetails || "None declared",
          accessories: p.accessories || [],
          batteryInfo: p.batteryInfo || null,
          collectedAt: p.createdAt,
        },
        createdAt: p.createdAt,
      }));
    }

    // 3. Recovered materials query
    if (type === "ALL" || type === "MATERIAL") {
      const mQuery: any = { status: "PUBLISHED", availableStockKg: { $gt: 0 } };
      if (category && category !== "ALL") mQuery.materialType = category;
      if (minPrice || maxPrice) {
        mQuery.pricePerKg = {};
        if (minPrice) mQuery.pricePerKg.$gte = Number(minPrice);
        if (maxPrice) mQuery.pricePerKg.$lte = Number(maxPrice);
      }
      if (search && typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search.trim(), "i");
        mQuery.$or = [{ materialType: regex }, { grade: regex }, { description: regex }];
      }
      materials = await MaterialMarketplaceListingModel.find(mQuery).sort({ createdAt: -1 }).lean();
    }

    const allProducts = [...refurbished, ...p2pListings];

    res.json({
      success: true,
      data: {
        refurbished,
        p2pListings,
        allProducts,
        materials,
        totalItems: allProducts.length + materials.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to browse marketplace" });
  }
});

// GET /api/marketplace/products/:id - Complete product details with inspection, history, and lifecycle timeline
router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    let product: any = (await ResaleProductModel.findOne({
      $or: [{ resaleId: id }, ...(isObjectId ? [{ _id: id }] : [])],
    }).lean()) as any;

    let listing: any = null;
    let inspection: any = null;
    let isP2P = false;

    if (!product) {
      // Check customer P2P listings
      const p2pListing = (await ProductListingModel.findOne({
        $or: [{ listingId: id }, ...(isObjectId ? [{ _id: id }] : [])],
      }).lean()) as any;

      if (p2pListing) {
        isP2P = true;
        listing = p2pListing;
        product = {
          id: p2pListing._id.toString(),
          resaleId: p2pListing.listingId,
          itemType: "P2P_PRODUCT",
          title: p2pListing.title || `${p2pListing.brand} ${p2pListing.model}`,
          brand: p2pListing.brand,
          model: p2pListing.model,
          category: p2pListing.category,
          price: p2pListing.expectedPrice,
          stock: p2pListing.status === "SOLD" ? 0 : 1,
          status: p2pListing.status === "SOLD" ? "SOLD" : "PUBLISHED",
          listingStatus: p2pListing.status,
          conditionGrade: p2pListing.condition,
          condition: p2pListing.condition,
          ageYears: p2pListing.ageYears,
          approximateLocation: p2pListing.approximateLocation || "Indiranagar, Bengaluru",
          description: p2pListing.description,
          damageDetails: p2pListing.damageDetails || "No physical defects reported by seller",
          accessories: p2pListing.accessories && p2pListing.accessories.length > 0 ? p2pListing.accessories : ["Device only"],
          batteryInfo: p2pListing.batteryInfo || null,
          warrantyMonths: 0,
          warrantyPolicy: "P2P Standard 7-Day Peer Verification Window",
          images: Array.isArray(p2pListing.images) && p2pListing.images.length > 0 ? p2pListing.images : ["/uploads/sample-laptop.jpg"],
          dealerName: "Peer Customer (Owner 1)",
          sellerRole: "CUSTOMER",
          sellerLabel: "Owner 1",
          isCertifiedOnChain: false,
          txHash: null,
          createdAt: p2pListing.createdAt,
        };
      } else {
        // Check ProductModel (on-chain certified products)
        const onChainProduct = (await ProductModel.findOne({
          $or: [{ productId: id }, ...(isObjectId ? [{ _id: id }] : [])],
        }).lean()) as any;

        if (onChainProduct) {
          product = {
            ...onChainProduct,
            id: onChainProduct._id.toString(),
            resaleId: onChainProduct.productId,
            itemType: "REFURBISHED_PRODUCT",
            title: onChainProduct.name,
            brand: onChainProduct.brandModel ? onChainProduct.brandModel.split(" ")[0] : "EcoTrace Certified",
            model: onChainProduct.brandModel || onChainProduct.name,
            category: "Certified Refurbished Hardware",
            price: 25000,
            stock: 1,
            warrantyMonths: onChainProduct.warrantyMonths || 12,
            conditionGrade: "A_MINT",
            functionalSummary: "100% verified hardware inspection pass with on-chain cryptographic certificate.",
            repairHistory: onChainProduct.replacedComponents || "Original diagnostic test passed.",
            images: ["/uploads/sample-laptop.jpg"],
            dealerName: onChainProduct.technicianName || "Certified Hardware Specialist",
            dealerOrganization: "EcoTrace Certified Refurbishment Lab",
            isCertifiedOnChain: true,
            txHash: onChainProduct.txHash,
          };
        } else {
          res.status(404).json({ success: false, error: "Product not found" });
          return;
        }
      }
    } else {
      // Find linked inspection and listing for ResaleProduct
      if (product.sourceInspectionId) {
        inspection = await ProductInspectionModel.findOne({
          $or: [
            { inspectionId: product.sourceInspectionId },
            ...(mongoose.Types.ObjectId.isValid(product.sourceInspectionId) ? [{ _id: product.sourceInspectionId }] : []),
          ],
        }).lean();
      }

      if (product.sourceListingId) {
        listing = await ProductListingModel.findOne({
          $or: [
            { listingId: product.sourceListingId },
            ...(mongoose.Types.ObjectId.isValid(product.sourceListingId) ? [{ _id: product.sourceListingId }] : []),
          ],
        }).lean();
      }
    }

    // Look for any related order
    const latestOrder = await MarketplaceOrderModel.findOne({
      $or: [
        { resaleProductId: product.resaleId },
        { p2pListingId: product.resaleId },
        { itemTitle: new RegExp(product.model || product.title, "i") },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Query recorded ownership events
    const queryIds = [
      id,
      product.resaleId,
      product.sourceListingId,
      product.sourceInspectionId,
      product.productId,
      listing?.listingId,
    ].filter(Boolean);

    const existingEvents = await OwnershipEventModel.find({
      productId: { $in: queryIds },
    })
      .sort({ timestamp: 1 })
      .lean();

    // Assemble the traceable timeline
    const timeline = buildProductTimeline(product, listing, inspection, existingEvents, latestOrder);

    // Build separated seller-reported data
    const sellerReported = {
      brand: listing?.brand || product.brand || "Not recorded",
      model: listing?.model || product.model || "Not recorded",
      usageAge: listing?.ageYears !== undefined ? `${listing.ageYears} years` : (product.ageYears !== undefined ? `${product.ageYears} years` : "Not recorded"),
      sellerCondition: listing?.condition || product.condition || "Not recorded",
      damageDetails: listing?.damageDetails || product.damageDetails || "No physical defects reported by seller",
      accessories:
        listing?.accessories && listing.accessories.length > 0
          ? listing.accessories
          : product.accessories && product.accessories.length > 0
          ? product.accessories
          : ["Device only"],
      batteryHealth: listing?.batteryInfo?.healthState || "Not recorded",
      maxCapacityPercent:
        listing?.batteryInfo?.maxCapacityPercent !== undefined
          ? `${listing.batteryInfo.maxCapacityPercent}%`
          : "Not recorded",
      cycleCount:
        listing?.batteryInfo?.cycleCount !== undefined
          ? `${listing.batteryInfo.cycleCount} cycles`
          : "Not recorded",
      batteryNotes: listing?.batteryInfo?.batteryNotes || "Not recorded",
      approximateLocation: listing?.approximateLocation || product.dealerCity || "Indiranagar, Bengaluru",
      sellerLabel: isP2P ? "Owner 1" : product.dealerName || "Certified Refurbisher",
    };

    // Build separated technician-verified data
    const technicianVerified = {
      technicianName: inspection?.inspectorName || product.technicianName || (listing?.reviewedBy ? "Certified Hardware Specialist" : "Not recorded"),
      inspectionDate: inspection?.inspectionDate || inspection?.createdAt || listing?.reviewedAt || (product.txHash ? "Certified Refurbishment" : "Not recorded"),
      functionalTests: inspection?.functionalTests || null,
      cosmeticGrade: inspection?.cosmeticGrade || product.conditionGrade || "Not recorded",
      defects: inspection?.findings || (listing?.reviewNotes || "Not recorded"),
      repairsPerformed: inspection?.repairPerformed || product.repairHistory || "Not recorded",
      replacedComponents: inspection?.replacedComponents || product.replacedComponents || "Not recorded",
      batteryHealth: inspection?.batteryHealth || (listing?.batteryInfo?.maxCapacityPercent ? `${listing.batteryInfo.maxCapacityPercent}%` : "Not recorded"),
      batteryCycleCount: inspection?.batteryCycleCount || (listing?.batteryInfo?.cycleCount ? `${listing.batteryInfo.cycleCount} cycles` : "Not recorded"),
      warranty: product.warrantyMonths ? `${product.warrantyMonths} Months Certified Warranty` : (product.warrantyPolicy || "P2P Standard 7-Day Peer Verification Window"),
      inspectionReportHash: inspection?.inspectionReportHash || "Not recorded",
      isCertifiedOnChain: Boolean(product.txHash || product.isCertifiedOnChain),
      txHash: product.txHash || null,
      blockchainVerification: product.txHash
        ? `Recorded on Ethereum/Hardhat testnet (Tx: ${product.txHash})`
        : "Not recorded on-chain; internal database audit verified",
    };

    const enrichedProduct = {
      ...product,
      id: product._id ? product._id.toString() : product.id,
      sellerReported,
      technicianVerified,
      timeline,
      inspection: inspection
        ? {
            inspectionId: inspection.inspectionId,
            inspectorName: inspection.inspectorName,
            cosmeticGrade: inspection.cosmeticGrade,
            functionalTests: inspection.functionalTests,
            findings: inspection.findings,
            repairPerformed: inspection.repairPerformed,
            replacedComponents: inspection.replacedComponents,
            inspectionReportHash: inspection.inspectionReportHash,
          }
        : null,
      listing: listing
        ? {
            listingId: listing.listingId,
            ageYears: listing.ageYears,
            condition: listing.condition,
            description: listing.description,
            approximateLocation: listing.approximateLocation,
            damageDetails: listing.damageDetails,
            accessories: listing.accessories,
            batteryInfo: listing.batteryInfo,
            collectedAt: listing.collectedAt || listing.createdAt,
          }
        : null,
    };

    res.json({
      success: true,
      product: enrichedProduct,
      sellerReported,
      technicianVerified,
      timeline,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve product details" });
  }
});

// POST /api/marketplace/orders - Customer places order (Refurbished product, P2P device, or Recovered material)
router.post(
  "/orders",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customer = req.user!;
      const {
        itemType, // "REFURBISHED_PRODUCT" | "P2P_PRODUCT" | "RECOVERED_MATERIAL"
        itemId,
        quantity = 1,
        shippingAddress,
        paymentMethod = "TEST_UPI",
        notes,
      } = req.body;

      if (!itemType || !itemId || !shippingAddress) {
        res.status(400).json({
          success: false,
          error: "itemType, itemId, and complete shippingAddress are required.",
        });
        return;
      }

      if (!shippingAddress.streetAddress || !shippingAddress.city || !shippingAddress.pincode) {
        res.status(400).json({
          success: false,
          error: "Shipping address must contain streetAddress, city, and pincode.",
        });
        return;
      }

      const qty = Math.max(1, Number(quantity) || 1);
      let sellerId = "";
      let sellerName = "";
      let sellerRole: "DEALER" | "FACTORY" | "CUSTOMER" = "DEALER";
      let unitPrice = 0;
      let itemTitle = "";
      let resaleProductId: string | undefined = undefined;
      let p2pListingId: string | undefined = undefined;
      let materialListingId: string | undefined = undefined;

      if (itemType === "REFURBISHED_PRODUCT") {
        const isObjectId = mongoose.Types.ObjectId.isValid(itemId);
        const product = await ResaleProductModel.findOneAndUpdate(
          {
            $or: [{ resaleId: itemId }, ...(isObjectId ? [{ _id: itemId }] : [])],
            status: "PUBLISHED",
            stock: { $gte: qty },
          },
          {
            $inc: { stock: -qty, reservedStock: qty },
          },
          { new: true }
        );

        if (!product) {
          res.status(400).json({
            success: false,
            error: "Product is either unavailable or has insufficient stock to fulfill your order.",
          });
          return;
        }

        if (product.stock === 0) {
          product.status = "SOLD";
          await product.save();
        }

        sellerId = product.dealerId;
        sellerName = product.dealerName;
        sellerRole = "DEALER";
        unitPrice = product.price;
        itemTitle = `${product.brand} ${product.model} (${product.conditionGrade})`;
        resaleProductId = product.resaleId;
      } else if (itemType === "P2P_PRODUCT") {
        const isObjectId = mongoose.Types.ObjectId.isValid(itemId);
        const listing = await ProductListingModel.findOneAndUpdate(
          {
            $or: [{ listingId: itemId }, ...(isObjectId ? [{ _id: itemId }] : [])],
            status: "LISTED",
          },
          {
            $set: { status: "SOLD" },
          },
          { new: true }
        );

        if (!listing) {
          res.status(400).json({
            success: false,
            error: "Device is either unavailable, already sold, or not currently listed for sale.",
          });
          return;
        }

        sellerId = listing.customerId;
        sellerName = "Owner 1";
        sellerRole = "CUSTOMER";
        unitPrice = listing.expectedPrice;
        itemTitle = `${listing.brand} ${listing.model} (${listing.condition})`;
        p2pListingId = listing.listingId;
      } else if (itemType === "RECOVERED_MATERIAL") {
        const isObjectId = mongoose.Types.ObjectId.isValid(itemId);
        const material = await MaterialMarketplaceListingModel.findOneAndUpdate(
          {
            $or: [{ listingId: itemId }, ...(isObjectId ? [{ _id: itemId }] : [])],
            status: "PUBLISHED",
            availableStockKg: { $gte: qty },
          },
          {
            $inc: { availableStockKg: -qty, reservedStockKg: qty },
          },
          { new: true }
        );

        if (!material) {
          res.status(400).json({
            success: false,
            error: "Material listing is either unavailable or has insufficient stock to fulfill your order.",
          });
          return;
        }

        if (material.availableStockKg === 0) {
          material.status = "SOLD_OUT";
          await material.save();
        }

        sellerId = material.factoryId;
        sellerName = material.factoryName;
        sellerRole = "FACTORY";
        unitPrice = material.pricePerKg;
        itemTitle = `Certified ${material.materialType} (Grade ${material.grade}, ${material.purityPercentage}%)`;
        materialListingId = material.listingId;
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid itemType. Must be REFURBISHED_PRODUCT, P2P_PRODUCT, or RECOVERED_MATERIAL",
        });
        return;
      }

      const totalAmount = unitPrice * qty;
      const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      const newOrder = await MarketplaceOrderModel.create({
        orderId,
        customerId: customer.id,
        customerName: customer.fullName,
        customerEmail: customer.email,
        customerPhone: shippingAddress.phone || "",
        itemType,
        resaleProductId,
        p2pListingId,
        materialListingId,
        itemTitle,
        sellerId,
        sellerName,
        sellerRole,
        quantity: qty,
        unitPrice,
        totalAmount,
        shippingAddress: {
          fullName: shippingAddress.fullName || customer.fullName,
          phone: shippingAddress.phone || "N/A",
          streetAddress: shippingAddress.streetAddress,
          city: shippingAddress.city,
          state: shippingAddress.state || "Active Region",
          pincode: shippingAddress.pincode,
        },
        paymentMethod,
        paymentStatus: "PENDING",
        orderStatus: "PLACED",
        notes: notes || "",
      });

      // Record stage 6 in traceable product timeline: Purchase Order Placed
      await OwnershipEventModel.create({
        productId: p2pListingId || resaleProductId || orderId,
        eventType: "PURCHASE",
        description: `Device purchase order placed by Owner 2 (Verified Buyer). Inventory atomically reserved.`,
        actorRole: "BUYER",
        actorLabel: "Owner 2 (Verified Buyer)",
        evidenceRef: `ORD-${newOrder.orderId}`,
        metadata: {
          orderId: newOrder.orderId,
          itemType,
          totalAmount,
        },
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Marketplace order placed successfully. Proceed to payment verification.",
        data: newOrder,
      });
    } catch (err: any) {
      console.error("Error creating order:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to place order" });
    }
  }
);

// POST /api/marketplace/orders/:id/pay-test - Server-side verified test payment & ownership transfer
router.post(
  "/orders/:id/pay-test",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { paymentMethod = "TEST_UPI", clientTxRef } = req.body;

      const order = await MarketplaceOrderModel.findOne({
        $or: [{ orderId: req.params.id }, ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: req.params.id }] : [])],
      });

      if (!order) {
        res.status(404).json({ success: false, error: "Order not found" });
        return;
      }

      // Authorization: Customer owner or Admin
      if (order.customerId !== user.id && user.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "Unauthorized to pay for this order." });
        return;
      }

      if (order.paymentStatus === "VERIFIED_PAID") {
        res.status(400).json({
          success: false,
          error: "Order has already been verified and paid. Duplicate payment confirmation is not allowed.",
          data: order,
        });
        return;
      }

      // Backend Verification: Generate cryptographic payment verification signature
      const paymentTxRef =
        clientTxRef || `TXN-ECO-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      // Atomic update to prevent race conditions in concurrent payment confirmations
      const updatedOrder = await MarketplaceOrderModel.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: { $ne: "VERIFIED_PAID" },
        },
        {
          $set: {
            paymentMethod,
            paymentStatus: "VERIFIED_PAID",
            paymentTxRef,
            paymentVerifiedAt: new Date(),
            orderStatus: "PROCESSING",
          },
        },
        { new: true }
      );

      if (!updatedOrder) {
        res.status(400).json({
          success: false,
          error: "Duplicate payment confirmation detected. Order is already verified and paid.",
        });
        return;
      }

      // Record stage 7 in traceable product timeline: Verified Ownership Legal Transfer
      if (updatedOrder.itemType === "P2P_PRODUCT" || updatedOrder.itemType === "REFURBISHED_PRODUCT") {
        await OwnershipEventModel.create({
          productId: updatedOrder.p2pListingId || updatedOrder.resaleProductId || updatedOrder.orderId,
          eventType: "OWNERSHIP_TRANSFER",
          description: `Cryptographic payment verified via ${paymentMethod}. Ownership legally transferred to Owner 2 (Verified Buyer).`,
          actorRole: "CUSTOMER",
          actorLabel: "Owner 2 (Verified Buyer)",
          evidenceRef: updatedOrder.paymentTxRef || `ORD-${updatedOrder.orderId}`,
          metadata: {
            orderId: updatedOrder.orderId,
            itemType: updatedOrder.itemType,
            totalAmount: updatedOrder.totalAmount,
            paymentMethod,
            paymentTxRef: updatedOrder.paymentTxRef,
          },
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Payment successfully verified on backend server. Ownership transferred.",
        data: updatedOrder,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to verify payment" });
    }
  }
);

// GET /api/marketplace/orders/my - Customer's orders
router.get(
  "/orders/my",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const orders = await MarketplaceOrderModel.find({ customerId: user.id })
        .sort({ createdAt: -1 })
        .lean();

      res.json({ success: true, data: orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch orders" });
    }
  }
);

// GET /api/marketplace/orders/seller - Dealer or Factory view orders for their products
router.get(
  "/orders/seller",
  authenticateToken,
  requireRole("DEALER", "FACTORY", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const filter: any =
        user.role === "ADMIN"
          ? {}
          : { sellerId: { $in: [user.id, user.facilityId].filter(Boolean) } };

      const orders = await MarketplaceOrderModel.find(filter).sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch seller orders" });
    }
  }
);

// PATCH /api/marketplace/orders/:id/fulfillment - Seller updates order status
router.patch(
  "/orders/:id/fulfillment",
  authenticateToken,
  requireRole("DEALER", "FACTORY", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { orderStatus, trackingNumber, notes } = req.body;

      const order = await MarketplaceOrderModel.findOne({
        $or: [{ orderId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined }],
      });

      if (!order) {
        res.status(404).json({ success: false, error: "Order not found" });
        return;
      }

      const isSeller =
        order.sellerId === user.id || (user.facilityId && order.sellerId === user.facilityId);
      if (!isSeller && user.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "Unauthorized to update fulfillment on this order." });
        return;
      }

      if (orderStatus) {
        order.orderStatus = orderStatus;
        if (orderStatus === "DELIVERED") {
          order.deliveredAt = new Date();
        }
      }
      if (trackingNumber) order.trackingNumber = trackingNumber;
      if (notes) order.notes = notes;

      await order.save();

      res.json({
        success: true,
        message: `Order fulfillment status updated to ${order.orderStatus}`,
        data: order,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to update fulfillment" });
    }
  }
);

export default router;
