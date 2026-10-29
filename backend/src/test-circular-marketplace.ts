import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import {
  ProductListingModel,
  DealerOfferModel,
  PickupTaskModel,
  ProductInspectionModel,
  ResaleProductModel,
  MaterialMarketplaceListingModel,
  MarketplaceOrderModel,
  UserModel,
  RecoveredMaterialModel,
  WasteBatchModel,
} from "./models";

dotenv.config({ path: path.join(__dirname, "../.env") });

const JWT_SECRET = process.env.JWT_SECRET || "ecotrace-super-secure-hackathon-jwt-secret-2026";
const API_BASE = "http://localhost:5000/api/marketplace";

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

async function runTests() {
  console.log("=== STARTING CIRCULAR MARKETPLACE AUTOMATED TEST SUITE ===");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI not found");
  }
  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB");

  // Fetch or find users for each role
  let customer = await UserModel.findOne({ role: "CUSTOMER" });
  let dealer = await UserModel.findOne({ role: "DEALER" });
  let driver = await UserModel.findOne({ role: "DRIVER" });
  let factory = await UserModel.findOne({ role: "FACTORY" });
  let admin = await UserModel.findOne({ role: "ADMIN" });

  if (!customer) {
    customer = await UserModel.create({
      fullName: "Test Customer",
      email: "test.customer@ecotrace.org",
      password: "hashedpassword",
      role: "CUSTOMER",
      phone: "+91 9876543210",
      status: "ACTIVE",
    });
  }
  if (!dealer) {
    dealer = await UserModel.create({
      fullName: "GreenCycle Electronics Dealer",
      email: "dealer.green@ecotrace.org",
      password: "hashedpassword",
      role: "DEALER",
      organization: "GreenCycle Refurbishers",
      status: "ACTIVE",
    });
  }
  if (!driver) {
    driver = await UserModel.create({
      fullName: "Rajesh Kumar (EcoDriver)",
      email: "driver.rajesh@ecotrace.org",
      password: "hashedpassword",
      role: "DRIVER",
      phone: "+91 9988776655",
      status: "ACTIVE",
    });
  }
  if (!factory) {
    factory = await UserModel.create({
      fullName: "EcoSmelt Recycling Facility",
      email: "factory.ecosmelt@ecotrace.org",
      password: "hashedpassword",
      role: "FACTORY",
      organization: "EcoSmelt Refining Corp",
      status: "ACTIVE",
    });
  }
  if (!admin) {
    admin = await UserModel.create({
      fullName: "System Admin",
      email: "admin@ecotrace.org",
      password: "hashedpassword",
      role: "ADMIN",
      status: "ACTIVE",
    });
  }

  const customerToken = makeToken(customer);
  const dealerToken = makeToken(dealer);
  const driverToken = makeToken(driver);
  const factoryToken = makeToken(factory);
  const adminToken = makeToken(admin);

  // -------------------------------------------------------------
  // TEST 1: Customer creates old electronics listing
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Customer creates old electronics listing...");
  const createListingRes = await fetch(`${API_BASE}/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      title: "MacBook Pro 15-inch (2019)",
      category: "Laptops & Computers",
      brand: "Apple",
      model: "A1990",
      ageYears: 4,
      condition: "WORKING",
      expectedPrice: 32000,
      description: "Minor battery degradation, screen and keyboard in pristine condition.",
      pickupAddress: "Flat 402, Green Valley Apartments, Indiranagar, Bengaluru, 560038",
      approximateLocation: "Indiranagar, Bengaluru",
      latitude: 12.9784,
      longitude: 77.6408,
      preferredPickupDate: "2026-11-02",
      preferredPickupTimeSlot: "Morning (9 AM - 1 PM)",
      customerPhone: "+91 9876543210",
      images: ["/uploads/sample-laptop.jpg"],
    }),
  });
  const listingData = await createListingRes.json() as any;
  if (!listingData.success) {
    throw new Error(`Failed to create listing: ${JSON.stringify(listingData)}`);
  }
  const createdListing = listingData.data;
  console.log(` Created listing: ${createdListing.listingId} (Status: ${createdListing.status})`);
  if (createdListing.status !== "PENDING_INSPECTION") {
    throw new Error(`Expected initial status to be PENDING_INSPECTION, got ${createdListing.status}`);
  }

  // -------------------------------------------------------------
  // TEST 1b: Verify unapproved listing is hidden from Dealer Nearby Listings
  // -------------------------------------------------------------
  console.log("\n[TEST 1b] Verifying unapproved PENDING_INSPECTION device is hidden from dealer nearby list...");
  const unapprovedNearbyRes = await fetch(
    `${API_BASE}/listings/nearby?latitude=12.9716&longitude=77.5946&maxDistanceKm=20`,
    {
      headers: { Authorization: `Bearer ${dealerToken}` },
    }
  );
  const unapprovedNearbyData = await unapprovedNearbyRes.json() as any;
  if (!unapprovedNearbyData.success) {
    throw new Error(`Failed to fetch nearby listings: ${JSON.stringify(unapprovedNearbyData)}`);
  }
  const foundPending = unapprovedNearbyData.data.find((l: any) => l.listingId === createdListing.listingId);
  if (foundPending) {
    throw new Error(`SECURITY VIOLATION: Unapproved PENDING_INSPECTION listing appeared in dealer nearby list!`);
  }
  console.log(` Verified: Device correctly withheld from dealer nearby listings while PENDING_INSPECTION.`);

  // -------------------------------------------------------------
  // TEST 1c: Admin/Inspector reviews and approves listing
  // -------------------------------------------------------------
  console.log("\n[TEST 1c] Admin inspects and approves customer listing...");
  const reviewRes = await fetch(`${API_BASE}/listings/${createdListing.listingId}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: "APPROVED",
      reviewNotes: "Passed technical diagnostic checks and battery integrity verification.",
    }),
  });
  const reviewData = await reviewRes.json() as any;
  if (!reviewData.success || reviewData.data.status !== "APPROVED") {
    throw new Error(`Failed to approve listing: ${JSON.stringify(reviewData)}`);
  }
  console.log(` Listing successfully reviewed and transitioned to APPROVED!`);

  // -------------------------------------------------------------
  // TEST 2: Dealer searches nearby listings & verifies privacy mask
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Dealer searches nearby listings & checks address privacy mask...");
  const nearbyRes = await fetch(
    `${API_BASE}/listings/nearby?latitude=12.9716&longitude=77.5946&maxDistanceKm=20`,
    {
      headers: { Authorization: `Bearer ${dealerToken}` },
    }
  );
  const nearbyData = await nearbyRes.json() as any;
  if (!nearbyData.success) {
    throw new Error(`Failed to fetch nearby listings: ${JSON.stringify(nearbyData)}`);
  }
  const foundListing = nearbyData.data.find((l: any) => l.listingId === createdListing.listingId);
  if (!foundListing) {
    throw new Error(`Approved listing not found in dealer's nearby list`);
  }
  console.log(
    ` Found nearby listing! Calculated distance: ${foundListing.distanceKm} km. Approx location: '${foundListing.approximateLocation}'`
  );
  if (foundListing.pickupAddress || foundListing.customerPhone) {
    throw new Error(`PRIVACY VIOLATION: Dealer saw customer exact address or phone before offer accepted!`);
  }
  console.log(` Privacy verified: Exact pickupAddress and customerPhone are masked from unaccepted dealers.`);

  // -------------------------------------------------------------
  // TEST 3: Dealer submits an offer
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Dealer submits offer to customer...");
  const offerRes = await fetch(`${API_BASE}/listings/${createdListing.listingId}/offer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${dealerToken}`,
    },
    body: JSON.stringify({
      offeredPrice: 30000,
      message: "Can pick up tomorrow morning with instant digital payout.",
      estimatedPickupHours: 18,
    }),
  });
  const offerData = await offerRes.json() as any;
  if (!offerData.success) {
    throw new Error(`Failed to submit dealer offer: ${JSON.stringify(offerData)}`);
  }
  const createdOffer = offerData.data;
  console.log(` Dealer offer created: ${createdOffer.offerId} (Offered: ₹${createdOffer.offeredPrice})`);

  // -------------------------------------------------------------
  // TEST 4: Customer accepts offer & OTP is generated
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Customer accepts dealer offer & verifies OTP generation...");
  const acceptRes = await fetch(`${API_BASE}/offers/${createdOffer.offerId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const acceptData = await acceptRes.json() as any;
  if (!acceptData.success) {
    throw new Error(`Failed to accept offer: ${JSON.stringify(acceptData)}`);
  }
  const handoverOtp = acceptData.data.handoverOtp;
  console.log(` Offer accepted! Secure 6-digit Handover OTP generated: [******] (Masked for security)`);

  // -------------------------------------------------------------
  // TEST 5: Dealer assigns driver for pickup
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Dealer assigns driver and vehicle for pickup dispatch...");
  const assignRes = await fetch(`${API_BASE}/listings/${createdListing.listingId}/assign-driver`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${dealerToken}`,
    },
    body: JSON.stringify({
      driverId: driver._id.toString(),
      vehicleRegistration: "KA-01-EQ-4089",
      vehicleType: "Electric Eco Van",
      notes: "Handle laptop with antistatic pouch.",
    }),
  });
  const assignData = await assignRes.json() as any;
  if (!assignData.success) {
    throw new Error(`Failed to assign driver: ${JSON.stringify(assignData)}`);
  }
  const pickupTask = assignData.data;
  console.log(` Pickup task created: ${pickupTask.taskId} (Status: ${pickupTask.status})`);

  // -------------------------------------------------------------
  // TEST 6: Driver updates status & shares live GPS coordinates
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Driver accepts trip, moves en route, and updates GPS tracking...");
  await fetch(`${API_BASE}/pickups/${pickupTask.taskId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({ status: "EN_ROUTE", note: "Driver on the way to customer address" }),
  });

  const gpsRes = await fetch(`${API_BASE}/pickups/${pickupTask.taskId}/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({
      latitude: 12.975,
      longitude: 77.635,
      heading: 45,
      speed: 28,
      accuracy: 5,
    }),
  });
  const gpsData = await gpsRes.json() as any;
  console.log(` GPS update saved: Distance: ${gpsData.data.distanceKm} km, ETA: ${gpsData.data.etaMinutes} mins`);

  // -------------------------------------------------------------
  // TEST 7: Handover OTP Verification (Test invalid OTP rejection, then valid OTP)
  // -------------------------------------------------------------
  console.log("\n[TEST 7] Testing Handover OTP verification and reuse prevention...");
  const badOtpRes = await fetch(`${API_BASE}/pickups/${pickupTask.taskId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({
      status: "COLLECTED",
      handoverOtp: "000000", // deliberately incorrect
    }),
  });
  const badOtpData = await badOtpRes.json() as any;
  if (badOtpData.success) {
    throw new Error(`SECURITY BUG: Collection succeeded with invalid OTP!`);
  }
  console.log(` Invalid OTP correctly rejected with message: "${badOtpData.error}"`);

  // Now verify with correct OTP
  const goodOtpRes = await fetch(`${API_BASE}/pickups/${pickupTask.taskId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({
      status: "COLLECTED",
      handoverOtp,
      actualWeightKg: 2.1,
      proofPhotos: ["/uploads/pickup-proof-laptop.jpg"],
    }),
  });
  const goodOtpData = await goodOtpRes.json() as any;
  if (!goodOtpData.success) {
    throw new Error(`Failed to complete collection with valid OTP: ${JSON.stringify(goodOtpData)}`);
  }
  console.log(` Pickup collection verified with OTP! Status is now COLLECTED (Weight: 2.1 kg)`);

  // Security test: Handover OTP reuse prevention
  const reuseOtpRes = await fetch(`${API_BASE}/pickups/${pickupTask.taskId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({
      status: "COLLECTED",
      handoverOtp,
    }),
  });
  const reuseOtpData = await reuseOtpRes.json() as any;
  if (reuseOtpData.success) {
    throw new Error(`SECURITY BUG: Handover OTP was reused after collection!`);
  }
  console.log(` OTP reuse prevention verified: Correctly rejected with message: "${reuseOtpData.error}"`);

  // -------------------------------------------------------------
  // TEST 8: Inspection Gate Check (Dealer inspects collected device)
  // -------------------------------------------------------------
  console.log("\n[TEST 8] Dealer conducts inspection and records functional tests...");
  const inspectionRes = await fetch(`${API_BASE}/inspections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${dealerToken}`,
    },
    body: JSON.stringify({
      listingId: createdListing.listingId,
      cosmeticGrade: "B_GOOD",
      functionalTests: {
        powerOn: true,
        displayWorks: true,
        touchOrKeysWork: true,
        batteryCharges: true,
        connectivityWorks: true,
        audioPortsWork: true,
      },
      decision: "REUSABLE_RESALE",
      findings: "Battery cycle count 380, thermal paste refreshed, clean motherboard.",
      repairPerformed: "Internal cleaning and fresh thermal compound applied.",
      suggestedResalePrice: 38000,
      warrantyMonths: 6,
    }),
  });
  const inspectionData = await inspectionRes.json() as any;
  if (!inspectionData.success) {
    throw new Error(`Failed to record inspection: ${JSON.stringify(inspectionData)}`);
  }
  const inspection = inspectionData.data;
  console.log(
    ` Inspection completed: ${inspection.inspectionId} (Grade: ${inspection.cosmeticGrade}, Decision: ${inspection.decision}, Hash: ${inspection.inspectionReportHash.slice(0, 16)}...)`
  );

  // -------------------------------------------------------------
  // TEST 9: Dealer publishes refurbished product to marketplace
  // -------------------------------------------------------------
  console.log("\n[TEST 9] Dealer publishes refurbished device to resale marketplace...");
  const publishRes = await fetch(`${API_BASE}/resale-products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${dealerToken}`,
    },
    body: JSON.stringify({
      sourceListingId: createdListing.listingId,
      sourceInspectionId: inspection.inspectionId,
      title: "Apple MacBook Pro 15-inch (2019, Touch Bar) - Certified Refurbished",
      category: "Laptops & Computers",
      brand: "Apple",
      model: "MacBook Pro A1990",
      description: "Fully tested and certified pre-owned MacBook Pro with 6 months dealer warranty.",
      price: 38000,
      conditionGrade: "B_GOOD",
      functionalSummary: "100% functional test pass. 6 months dealer warranty.",
      repairHistory: "Thermal paste renewed, interior dust cleared.",
      warrantyMonths: 6,
      stock: 1,
      images: ["/uploads/sample-laptop.jpg"],
    }),
  });
  const publishData = await publishRes.json() as any;
  if (!publishData.success) {
    throw new Error(`Failed to publish resale product: ${JSON.stringify(publishData)}`);
  }
  const resaleProduct = publishData.data;
  console.log(` Refurbished product published: ${resaleProduct.resaleId} (₹${resaleProduct.price}, Stock: ${resaleProduct.stock})`);

  // -------------------------------------------------------------
  // TEST 10: Factory lists recovered materials with mass balance check
  // -------------------------------------------------------------
  console.log("\n[TEST 10] Factory creates recovered material listing with mass balance verification...");
  // Create a fresh test recovered material batch for idempotent test run
  const testBatchId = `TEST-COPPER-${Date.now().toString(36).toUpperCase()}`;
  const recMaterial = await RecoveredMaterialModel.create({
    materialBatchId: testBatchId,
    sourceBatchId: "BATCH-2026-TEST",
    processingRecordId: "PROC-2026-TEST",
    materialType: "Copper (High-Grade 99.9%)",
    recoveredWeightKg: 100,
    claimedWeightKg: 0,
    purityPercentage: 99.9,
  });

  const matListingRes = await fetch(`${API_BASE}/material-listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${factoryToken}`,
    },
    body: JSON.stringify({
      sourceMaterialBatchId: recMaterial.materialBatchId,
      sourceWasteBatchId: recMaterial.sourceBatchId,
      materialType: "Copper (High-Grade 99.9%)",
      purityPercentage: 99.9,
      grade: "A1_ELECTROLYTIC",
      totalListedWeightKg: 50,
      pricePerKg: 780,
      minimumOrderKg: 5,
      description: "Recycled cathode copper ingots conforming to ASTM B115 standard.",
    }),
  });
  const matListingData = await matListingRes.json() as any;
  if (!matListingData.success) {
    throw new Error(`Failed to create material listing: ${JSON.stringify(matListingData)}`);
  }
  const matListing = matListingData.data;
  console.log(` Recovered material listing created: ${matListing.listingId} (Available: ${matListing.availableStockKg} kg @ ₹${matListing.pricePerKg}/kg)`);

  // -------------------------------------------------------------
  // TEST 11: Customer places order, prevents overselling
  // -------------------------------------------------------------
  console.log("\n[TEST 11] Customer places order for refurbished laptop and checks stock reduction...");
  const orderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      itemType: "REFURBISHED_PRODUCT",
      itemId: resaleProduct.resaleId,
      quantity: 1,
      shippingAddress: {
        fullName: "Test Customer",
        phone: "+91 9876543210",
        streetAddress: "Flat 402, Green Valley Apartments",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038",
      },
      paymentMethod: "TEST_UPI",
    }),
  });
  const orderData = await orderRes.json() as any;
  if (!orderData.success) {
    throw new Error(`Failed to place order: ${JSON.stringify(orderData)}`);
  }
  const createdOrder = orderData.data;
  console.log(` Order placed: ${createdOrder.orderId} (Total: ₹${createdOrder.totalAmount}, Status: ${createdOrder.orderStatus})`);

  // Test overselling prevention: Stock was 1, now 0 -> Attempting another order must fail
  const oversellRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      itemType: "REFURBISHED_PRODUCT",
      itemId: resaleProduct.resaleId,
      quantity: 1,
      shippingAddress: {
        fullName: "Another Customer",
        phone: "+91 9999999999",
        streetAddress: "Some Address",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
    }),
  });
  const oversellData = await oversellRes.json() as any;
  if (oversellData.success) {
    throw new Error(`BUG: Overselling was permitted on zero-stock product!`);
  }
  console.log(` Overselling prevention verified: Second order correctly rejected (${oversellData.error})`);

  // -------------------------------------------------------------
  // TEST 12: Server-side Payment Verification
  // -------------------------------------------------------------
  console.log("\n[TEST 12] Customer completes backend-verified test payment...");
  const payRes = await fetch(`${API_BASE}/orders/${createdOrder.orderId}/pay-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ paymentMethod: "TEST_UPI" }),
  });
  const payData = await payRes.json() as any;
  if (!payData.success || payData.data.paymentStatus !== "VERIFIED_PAID") {
    throw new Error(`Payment verification failed: ${JSON.stringify(payData)}`);
  }
  console.log(` Payment verified on server: TxRef ${payData.data.paymentTxRef} (Payment Status: ${payData.data.paymentStatus})`);

  // Security test: Duplicate payment confirmation prevention
  const dupPayRes = await fetch(`${API_BASE}/orders/${createdOrder.orderId}/pay-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ paymentMethod: "TEST_UPI" }),
  });
  const dupPayData = await dupPayRes.json() as any;
  if (dupPayData.success) {
    throw new Error(`SECURITY BUG: Duplicate payment confirmation succeeded!`);
  }
  console.log(` Duplicate payment prevention verified: Correctly rejected with message: "${dupPayData.error}"`);

  console.log("\n========================================================");
  console.log(" ALL 12 CIRCULAR MARKETPLACE BACKEND TESTS PASSED 100%!");
  console.log("========================================================\n");
  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
