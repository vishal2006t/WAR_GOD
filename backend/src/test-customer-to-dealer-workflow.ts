/**
 * ECOTRACE — CUSTOMER-TO-DEALER DEVICE WORKFLOW & INSPECTION TEST SUITE
 * 
 * Verifies the complete lifecycle:
 * Customer Submission (PENDING_INSPECTION) -> Admin Inspection Queue ->
 * Inspection Approval (APPROVED) -> Published Dealer Nearby Listing (with privacy protection)
 * 
 * Tests:
 * 1. Customer submits a device and the record is persisted with PENDING_INSPECTION.
 * 2. Pending devices appear in the admin inspection queue.
 * 3. Pending devices do not appear in dealer public listings (and cannot receive offers).
 * 4. Admin approval updates the correct device and status to APPROVED.
 * 5. An approved, eligible device appears in dealer Nearby Listings (privacy masked).
 * 6. Rejected devices do not appear in dealer listings.
 * 7. Location, category, and pagination filters behave correctly.
 * 8. Unauthorized users cannot perform admin inspection actions (HTTP 403).
 * 9. Existing customer, dealer, admin, marketplace, and audit workflows continue to work.
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { UserModel, ProductListingModel, DealerOfferModel, OwnershipEventModel } from "./models";

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/ecotrace";
const PORT = process.env.PORT || 5000;
const API_BASE = `http://localhost:${PORT}/api/marketplace`;
const JWT_SECRET = process.env.JWT_SECRET || "ecotrace-super-secure-hackathon-jwt-secret-2026";

function makeToken(user: any) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      facilityId: user.facilityId?.toString() || null,
      organization: user.organization || null,
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  [✓ PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [✗ FAIL] ${testName}`);
    if (detail !== undefined) {
      console.error("         Detail:", detail);
    }
    failed++;
  }
}

async function runTests() {
  console.log("=======================================================================");
  console.log("  ECOTRACE — CUSTOMER-TO-DEALER DEVICE WORKFLOW & INSPECTION TEST SUITE");
  console.log("=======================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB successfully.\n");

  // Fetch or create users
  let customer = await UserModel.findOne({ role: "CUSTOMER" });
  let dealer = await UserModel.findOne({ role: "DEALER" });
  let admin = await UserModel.findOne({ role: "ADMIN" });

  if (!customer) {
    customer = await UserModel.create({
      fullName: "Priya Sharma (Workflow Test Customer)",
      email: "workflow.customer@ecotrace.org",
      password: "hashedpassword123",
      role: "CUSTOMER",
      phone: "+91 9876543210",
      status: "ACTIVE",
    });
  }
  if (!dealer) {
    dealer = await UserModel.create({
      fullName: "GreenCycle Electronics Dealer",
      email: "dealer.greencycle@ecotrace.org",
      password: "hashedpassword123",
      role: "DEALER",
      organization: "GreenCycle Refurbishers",
      status: "ACTIVE",
    });
  }
  if (!admin) {
    admin = await UserModel.create({
      fullName: "National Audit Administrator",
      email: "admin.audit@ecotrace.org",
      password: "hashedpassword123",
      role: "ADMIN",
      status: "ACTIVE",
    });
  }

  const customerToken = makeToken(customer);
  const dealerToken = makeToken(dealer);
  const adminToken = makeToken(admin);

  const cleanupListingIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Customer submits device and record is persisted
    // -------------------------------------------------------------------------
    console.log("[TEST 1] Customer submits device & record is persisted with PENDING_INSPECTION");
    const devicePayload = {
      title: "ThinkPad X1 Carbon Gen 9",
      category: "Laptops & Computers",
      brand: "Lenovo",
      model: "ThinkPad X1",
      ageYears: 2,
      condition: "WORKING",
      expectedPrice: 42000,
      description: "Business laptop in excellent cosmetic condition with 92% battery health.",
      pickupAddress: "14B Koramangala 4th Block, Bengaluru, Karnataka 560034",
      approximateLocation: "Koramangala, Bengaluru",
      latitude: 12.9352,
      longitude: 77.6245,
      preferredPickupDate: "2026-11-05",
      preferredPickupTimeSlot: "Morning (9 AM - 1 PM)",
      customerPhone: "+91 9876543210",
      accessories: ["Original USB-C Charger", "Laptop Sleeve"],
      batteryInfo: {
        healthState: "EXCELLENT",
        maxCapacityPercent: 92,
        cycleCount: 140,
        batteryNotes: "Original Lenovo battery",
      },
    };

    const createRes = await fetch(`${API_BASE}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(devicePayload),
    });

    const createData = (await createRes.json()) as any;
    assert(createRes.status === 201, "Customer submit returns HTTP 201 Created");
    assert(createData.success === true, "Response reports success: true");
    assert(Boolean(createData.data?.listingId), "Generated unique listingId");
    assert(createData.data?.status === "PENDING_INSPECTION", "Initial status is strictly PENDING_INSPECTION");

    const listingId1 = createData.data?.listingId;
    if (listingId1) cleanupListingIds.push(listingId1);

    // Verify DB persistence
    const dbListing1 = await ProductListingModel.findOne({ listingId: listingId1 }).lean();
    assert(Boolean(dbListing1), "Device listing is persisted in MongoDB");
    assert(dbListing1?.customerId === customer._id.toString(), "Listing correctly links to customerId");
    assert(dbListing1?.status === "PENDING_INSPECTION", "Persisted DB status is PENDING_INSPECTION");

    // -------------------------------------------------------------------------
    // TEST 2: Pending device appears in the admin inspection queue
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Pending devices appear in the admin inspection queue");
    const inspectQueueRes = await fetch(`${API_BASE}/listings/inspection?status=PENDING_INSPECTION`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inspectQueueData = (await inspectQueueRes.json()) as any;
    assert(inspectQueueRes.status === 200, "GET /listings/inspection returns HTTP 200");
    assert(inspectQueueData.success === true, "Inspection queue reports success: true");
    assert(Array.isArray(inspectQueueData.data), "Returns array of inspection listings");

    const foundInQueue = inspectQueueData.data.find((l: any) => l.listingId === listingId1);
    assert(Boolean(foundInQueue), "Newly submitted device is present in admin inspection queue");
    assert(foundInQueue?.status === "PENDING_INSPECTION", "Queue item has status PENDING_INSPECTION");
    assert(Boolean(foundInQueue?.pickupAddress), "Admin can view pickup address for operational dispatch");

    // -------------------------------------------------------------------------
    // TEST 3: Pending devices do NOT appear in dealer public listings & cannot receive offers
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Pending devices do NOT appear in dealer public listings");
    const nearbyResBefore = await fetch(
      `${API_BASE}/listings/nearby?latitude=12.9352&longitude=77.6245&maxDistanceKm=50`,
      {
        headers: { Authorization: `Bearer ${dealerToken}` },
      }
    );
    const nearbyDataBefore = (await nearbyResBefore.json()) as any;
    assert(nearbyResBefore.status === 200, "Dealer GET /listings/nearby returns HTTP 200");
    assert(nearbyDataBefore.success === true, "Nearby response reports success: true");

    const pendingInNearby = nearbyDataBefore.data.find((l: any) => l.listingId === listingId1);
    assert(
      pendingInNearby === undefined,
      "Pending unapproved device is strictly excluded from dealer Nearby Listings"
    );

    // Gating check: Attempting to submit a dealer offer on a PENDING_INSPECTION device must fail
    const prematureOfferRes = await fetch(`${API_BASE}/listings/${listingId1}/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dealerToken}`,
      },
      body: JSON.stringify({
        offeredPrice: 40000,
        message: "Premature offer before inspection",
      }),
    });
    const prematureOfferData = (await prematureOfferRes.json()) as any;
    assert(prematureOfferRes.status === 400, "Premature offer on pending device is rejected with HTTP 400");
    assert(prematureOfferData.success === false, "Premature offer reports success: false");

    // -------------------------------------------------------------------------
    // TEST 4: Admin approval updates the correct device and status
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Admin approval updates the correct device and status to APPROVED");
    const reviewRes = await fetch(`${API_BASE}/listings/${listingId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: "APPROVED",
        reviewNotes: "Passed comprehensive hardware and visual diagnostic check.",
      }),
    });
    const reviewData = (await reviewRes.json()) as any;
    assert(reviewRes.status === 200, "Admin review returns HTTP 200");
    assert(reviewData.success === true, "Review reports success: true");
    assert(reviewData.data?.status === "APPROVED", "Listing status transitioned to APPROVED");
    assert(reviewData.data?.listingId === listingId1, "Updated the correct listing ID");

    // Verify DB update
    const dbListingApproved = await ProductListingModel.findOne({ listingId: listingId1 }).lean();
    assert(dbListingApproved?.status === "APPROVED", "MongoDB record status is now APPROVED");
    assert(
      dbListingApproved?.reviewNotes === "Passed comprehensive hardware and visual diagnostic check.",
      "MongoDB review notes recorded accurately"
    );

    // Verify Lifecycle Ownership Event was recorded
    const event = await OwnershipEventModel.findOne({
      productId: listingId1,
      eventType: "INSPECTION",
    }).lean();
    assert(Boolean(event), "Traceable lifecycle OwnershipEvent recorded for INSPECTION");

    // -------------------------------------------------------------------------
    // TEST 5: Approved, eligible device appears in dealer Nearby Listings
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Approved, eligible device appears in dealer Nearby Listings");
    const nearbyResAfter = await fetch(
      `${API_BASE}/listings/nearby?latitude=12.9352&longitude=77.6245&maxDistanceKm=50`,
      {
        headers: { Authorization: `Bearer ${dealerToken}` },
      }
    );
    const nearbyDataAfter = (await nearbyResAfter.json()) as any;
    assert(nearbyResAfter.status === 200, "Dealer GET /listings/nearby returns HTTP 200");

    const approvedInNearby = nearbyDataAfter.data.find((l: any) => l.listingId === listingId1);
    assert(Boolean(approvedInNearby), "Approved device NOW appears in dealer Nearby Listings");
    assert(approvedInNearby?.title === "ThinkPad X1 Carbon Gen 9", "Listing preserves accurate device title");
    assert(approvedInNearby?.expectedPrice === 42000, "Listing preserves accurate expected price");

    // Privacy mask check: exact customer street address and phone must be masked
    assert(
      approvedInNearby?.pickupAddress === undefined,
      "Customer exact street address is masked from dealer before offer acceptance"
    );
    assert(
      approvedInNearby?.customerPhone === undefined,
      "Customer phone number is masked from dealer before offer acceptance"
    );
    assert(
      approvedInNearby?.approximateLocation === "Koramangala, Bengaluru",
      "Public approximate location is preserved for regional proximity filtering"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Rejected devices do NOT appear in dealer listings
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Rejected devices do NOT appear in dealer listings");
    // Customer submits second device
    const createRes2 = await fetch(`${API_BASE}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: "Severely Damaged Tablet",
        category: "Smartphones & Tablets",
        brand: "Generic",
        model: "Tab-X",
        ageYears: 5,
        condition: "NOT_WORKING",
        expectedPrice: 1500,
        description: "Cracked display and swollen battery cell.",
        pickupAddress: "22 Indiranagar, Bengaluru, 560038",
        approximateLocation: "Indiranagar, Bengaluru",
        latitude: 12.9784,
        longitude: 77.6408,
        preferredPickupDate: "2026-11-06",
      }),
    });
    const createData2 = (await createRes2.json()) as any;
    const listingId2 = createData2.data?.listingId;
    if (listingId2) cleanupListingIds.push(listingId2);

    // Admin rejects second device
    const rejectRes = await fetch(`${API_BASE}/listings/${listingId2}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: "REJECTED",
        reviewNotes: "Battery swelling poses safety hazard. Must be disposed via direct hazmat intake.",
      }),
    });
    const rejectData = (await rejectRes.json()) as any;
    assert(rejectRes.status === 200, "Admin reject returns HTTP 200");
    assert(rejectData.data?.status === "REJECTED", "Second listing status is REJECTED");

    // Verify rejected device is NOT in dealer Nearby Listings
    const nearbyResCheckRejected = await fetch(
      `${API_BASE}/listings/nearby?latitude=12.9784&longitude=77.6408&maxDistanceKm=50`,
      {
        headers: { Authorization: `Bearer ${dealerToken}` },
      }
    );
    const nearbyCheckData = (await nearbyResCheckRejected.json()) as any;
    const rejectedInNearby = nearbyCheckData.data.find((l: any) => l.listingId === listingId2);
    assert(rejectedInNearby === undefined, "Rejected device is strictly hidden from dealer Nearby Listings");

    // -------------------------------------------------------------------------
    // TEST 7: Location, category, and pagination filters behave correctly
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Location, category, search, and pagination filters behave correctly");
    // Filter matching category
    const catMatchRes = await fetch(
      `${API_BASE}/listings/nearby?category=Laptops%20%26%20Computers`,
      { headers: { Authorization: `Bearer ${dealerToken}` } }
    );
    const catMatchData = (await catMatchRes.json()) as any;
    assert(
      catMatchData.data.some((l: any) => l.listingId === listingId1),
      "Matching category query includes the approved laptop"
    );

    // Filter non-matching category
    const catMismatchRes = await fetch(
      `${API_BASE}/listings/nearby?category=Consumer%20Electronics`,
      { headers: { Authorization: `Bearer ${dealerToken}` } }
    );
    const catMismatchData = (await catMismatchRes.json()) as any;
    assert(
      !catMismatchData.data.some((l: any) => l.listingId === listingId1),
      "Mismatched category query excludes the approved laptop"
    );

    // Search query
    const searchRes = await fetch(
      `${API_BASE}/listings/nearby?search=ThinkPad`,
      { headers: { Authorization: `Bearer ${dealerToken}` } }
    );
    const searchData = (await searchRes.json()) as any;
    assert(
      searchData.data.some((l: any) => l.listingId === listingId1),
      "Search keyword query ('ThinkPad') finds the approved laptop"
    );

    // Pagination
    const pageRes = await fetch(
      `${API_BASE}/listings/nearby?page=1&limit=2`,
      { headers: { Authorization: `Bearer ${dealerToken}` } }
    );
    const pageData = (await pageRes.json()) as any;
    assert(pageData.pagination !== undefined, "Nearby endpoint returns pagination metadata object");
    assert(pageData.pagination.page === 1, "Pagination page is 1");
    assert(pageData.pagination.limit === 2, "Pagination limit respected (2 items per page)");
    assert(pageData.data.length <= 2, "Returned items do not exceed page limit");

    // -------------------------------------------------------------------------
    // TEST 8: Unauthorized users cannot perform admin inspection actions
    // -------------------------------------------------------------------------
    console.log("\n[TEST 8] Unauthorized users cannot perform admin inspection actions");
    // Customer attempts to review/approve
    const unauthorizedReviewRes = await fetch(`${API_BASE}/listings/${listingId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ decision: "APPROVED" }),
    });
    assert(
      unauthorizedReviewRes.status === 403,
      "Customer attempting inspection review is blocked with HTTP 403 Forbidden"
    );

    // Unauthenticated attempt
    const unauthenticatedReviewRes = await fetch(`${API_BASE}/listings/${listingId1}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVED" }),
    });
    assert(
      unauthenticatedReviewRes.status === 401,
      "Unauthenticated request to inspection review is blocked with HTTP 401 Unauthorized"
    );

    // Customer attempts to view inspection queue
    const unauthorizedQueueRes = await fetch(`${API_BASE}/listings/inspection`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      unauthorizedQueueRes.status === 403,
      "Customer attempting to view inspection queue is blocked with HTTP 403 Forbidden"
    );

    // -------------------------------------------------------------------------
    // TEST 9: Existing dealer, customer, and marketplace workflows continue
    // -------------------------------------------------------------------------
    console.log("\n[TEST 9] Existing dealer buy offer workflow on approved device");
    const validOfferRes = await fetch(`${API_BASE}/listings/${listingId1}/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dealerToken}`,
      },
      body: JSON.stringify({
        offeredPrice: 41000,
        message: "Certified dealer doorstep collection with instantaneous digital payment.",
        estimatedPickupHours: 24,
      }),
    });
    const validOfferData = (await validOfferRes.json()) as any;
    assert(validOfferRes.status === 201, "Dealer successfully submits buy offer on approved device (HTTP 201)");
    assert(validOfferData.success === true, "Offer reports success: true");

    const updatedListingDoc = await ProductListingModel.findOne({ listingId: listingId1 }).lean();
    assert(
      updatedListingDoc?.status === "OFFERS_RECEIVED",
      "Listing status transitioned from APPROVED to OFFERS_RECEIVED"
    );
    assert(updatedListingDoc?.offersCount === 1, "Listing offersCount incremented to 1");

  } finally {
    // Clean up test listings
    if (cleanupListingIds.length > 0) {
      await ProductListingModel.deleteMany({ listingId: { $in: cleanupListingIds } });
      await DealerOfferModel.deleteMany({ listingId: { $in: cleanupListingIds } });
      await OwnershipEventModel.deleteMany({ productId: { $in: cleanupListingIds } });
      console.log(`\nCleaned up ${cleanupListingIds.length} test listings and related records.`);
    }
    await mongoose.disconnect();
  }

  console.log("\n=======================================================================");
  console.log(`WORKFLOW TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution threw an unhandled error:", err);
  process.exit(1);
});
