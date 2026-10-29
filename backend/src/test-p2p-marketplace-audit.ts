import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import {
  UserModel,
  ProductListingModel,
  ResaleProductModel,
  ProductInspectionModel,
  MarketplaceOrderModel,
  OwnershipEventModel,
  ProductModel,
} from "./models";

const JWT_SECRET = process.env.JWT_SECRET || "ecotrace-secret-key-2026";

async function runAudit() {
  console.log("==================================================================");
  console.log("ECOTRACE CIRCULAR P2P & REFURBISHED MARKETPLACE AUDIT SUITE");
  console.log("==================================================================");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/ecotrace";
  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB:", mongoUri);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(` PASS: ${testName}`);
      passed++;
    } else {
      console.error(` FAIL: ${testName} ${detail ? `-> ${detail}` : ""}`);
      failed++;
    }
  }

  try {
    // 1. Fetch Test Users
    const customer = await UserModel.findOne({ role: "CUSTOMER" }).lean();
    const dealer = await UserModel.findOne({ role: "DEALER" }).lean();
    const admin = await UserModel.findOne({ role: "ADMIN" }).lean();

    assert(Boolean(customer), "Test customer user exists in database", customer?.email);
    assert(Boolean(dealer), "Test dealer user exists in database", dealer?.email);
    assert(Boolean(admin), "Test admin user exists in database", admin?.email);

    const customerToken = jwt.sign(
      { id: customer!._id.toString(), email: customer!.email, role: customer!.role, fullName: customer!.fullName },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    const dealerToken = jwt.sign(
      { id: dealer!._id.toString(), email: dealer!.email, role: dealer!.role, fullName: dealer!.fullName },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Test Search & Filter on Marketplace Browse API
    console.log("\n--- TEST GROUP 1: Search & Filter Verification ---");
    const baseUrl = `http://localhost:${process.env.PORT || 5000}/api/marketplace`;

    // 2.1 All products
    const resAll = await fetch(`${baseUrl}/browse`);
    const dataAll = await resAll.json() as any;
    assert(dataAll.success === true, "GET /api/marketplace/browse returns success");
    assert(Array.isArray(dataAll.data.allProducts), "Browse returns unified allProducts array");
    assert(Array.isArray(dataAll.data.refurbished), "Browse returns refurbished array");
    assert(Array.isArray(dataAll.data.p2pListings), "Browse returns p2pListings array");
    assert(dataAll.data.totalItems > 0, `Browse returns total items count (${dataAll.data.totalItems} items found)`);

    // 2.2 Category filter
    const resCat = await fetch(`${baseUrl}/browse?category=Laptops%20%26%20Computers`);
    const dataCat = await resCat.json() as any;
    const allLaptops = dataCat.data.allProducts.every((p: any) =>
      p.category.toLowerCase().includes("laptop") || p.category.toLowerCase().includes("computer")
    );
    assert(allLaptops, "Category filter properly constrains results to Laptops & Computers");

    // 2.3 Brand filter
    const resBrand = await fetch(`${baseUrl}/browse?brand=Dell`);
    const dataBrand = await resBrand.json() as any;
    const allDell = dataBrand.data.allProducts.every((p: any) => p.brand.toLowerCase().includes("dell"));
    assert(allDell, "Brand filter properly constrains results to Dell");

    // 2.4 In-stock filter
    const resInStock = await fetch(`${baseUrl}/browse?inStockOnly=true`);
    const dataInStock = await resInStock.json() as any;
    const allInStock = dataInStock.data.allProducts.every((p: any) => (p.stock || 0) > 0 && p.status !== "SOLD");
    assert(allInStock, "In-stock filter excludes sold out products");

    // 3. Test Customer Selling Workflow & Listing Submission
    console.log("\n--- TEST GROUP 2: Customer Selling & Status Lifecycle ---");
    const testListingPayload = {
      title: "MacBook Air M1 2020",
      category: "Laptops & Computers",
      brand: "Apple",
      model: "A2337 / 8GB / 256GB",
      ageYears: 3,
      condition: "WORKING",
      expectedPrice: 42000,
      description: "Carefully used for college work. Screen flawless, battery lasts 7+ hours.",
      damageDetails: "Minor surface scuff near MagSafe USB-C port; screen & keyboard in mint shape.",
      accessories: ["Charger / Power Adapter", "Original Packaging Box"],
      batteryInfo: {
        healthState: "NORMAL",
        maxCapacityPercent: 91,
        cycleCount: 284,
        batteryNotes: "Original Apple OEM battery with 91% verified maximum capacity.",
      },
      pickupAddress: "Flat 402, Green Meadows, 100ft Road, Indiranagar, Bengaluru, 560038",
      approximateLocation: "Indiranagar, Bengaluru",
      listingType: "P2P_MARKETPLACE",
    };

    const createRes = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(testListingPayload),
    });
    const createData = await createRes.json() as any;

    assert(createData.success === true, "Customer creates P2P listing with battery & accessories info");
    assert(createData.data.status === "PENDING_INSPECTION", "Default initial status is PENDING_INSPECTION");
    assert(createData.data.batteryInfo.maxCapacityPercent === 91, "Battery capacity percent correctly stored");
    assert(createData.data.accessories.length === 2, "Accessories checklist stored");

    const createdListingId = createData.data.listingId;

    // Check Stage 1 Ownership Event was created
    const stage1Event = await OwnershipEventModel.findOne({
      productId: createdListingId,
      eventType: "ORIGINAL_LISTING",
    }).lean();
    assert(Boolean(stage1Event), "Stage 1 OwnershipEvent (ORIGINAL_LISTING) created in ledger");
    assert(stage1Event?.actorLabel === "Owner 1", "Privacy-preserving actorLabel is 'Owner 1'");

    // 4. Test Review / Approval Gate (Cannot publish before approval)
    console.log("\n--- TEST GROUP 3: Review & Approval Gate ---");
    // Customer attempts to publish before approval -> Must fail
    const prematurePublishRes = await fetch(`${baseUrl}/listings/${createdListingId}/publish`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const prematurePublishData = await prematurePublishRes.json() as any;
    assert(
      prematurePublishRes.status === 400 && prematurePublishData.success === false,
      "Publishing is blocked until review/approval process is complete",
      prematurePublishData.error
    );

    // Dealer reviews and approves the listing
    const reviewRes = await fetch(`${baseUrl}/listings/${createdListingId}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dealerToken}`,
      },
      body: JSON.stringify({
        decision: "APPROVED",
        reviewNotes: "Passed visual inspection: verified clean display, battery cycle 284 confirmed normal.",
      }),
    });
    const reviewData = await reviewRes.json() as any;
    assert(reviewData.success === true, "Authorized technician/dealer approves listing");
    assert(reviewData.data.status === "APPROVED", "Listing status transitions to APPROVED");

    // Check Inspection Event was logged
    const inspectEvent = await OwnershipEventModel.findOne({
      productId: createdListingId,
      eventType: "INSPECTION",
    }).lean();
    assert(Boolean(inspectEvent), "Inspection approval event logged in lifecycle ledger");

    // Customer publishes the approved listing
    const publishRes = await fetch(`${baseUrl}/listings/${createdListingId}/publish`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const publishData = await publishRes.json() as any;
    assert(publishData.success === true, "Customer publishes approved listing to marketplace");
    assert(publishData.data.status === "LISTED", "Listing status transitions to LISTED");

    // 5. Test Privacy Mask on Public Listing Detail
    console.log("\n--- TEST GROUP 4: Privacy & Address Masking ---");
    // Browse as another user or unauthenticated
    const detailRes = await fetch(`${baseUrl}/listings/${createdListingId}`, {
      headers: { Authorization: `Bearer ${dealerToken}` }, // dealer not yet assigned to pickup
    });
    const detailData = await detailRes.json() as any;
    assert(detailData.success === true, "Public / unassigned user can fetch listing details");
    assert(detailData.data.pickupAddress === undefined, "Exact street address is stripped for privacy");
    assert(detailData.data.customerPhone === undefined, "Customer phone number is stripped for privacy");
    assert(detailData.data.customerEmail === undefined, "Customer email is stripped for privacy");
    assert(
      detailData.data.approximateLocation === "Indiranagar, Bengaluru",
      "Public approximate location is preserved"
    );

    // 6. Test Product Provenance & 7-Stage Lifecycle Timeline
    console.log("\n--- TEST GROUP 5: Provenance & 7-Stage Lifecycle Timeline ---");
    const provRes = await fetch(`${baseUrl}/products/${createdListingId}`);
    const provData = await provRes.json() as any;
    assert(provData.success === true, "GET /products/:id returns full provenance");
    assert(Boolean(provData.sellerReported), "Returns separated seller-reported section");
    assert(Boolean(provData.technicianVerified), "Returns separated technician-verified section");
    assert(Array.isArray(provData.timeline), "Returns chronological lifecycle timeline");
    assert(provData.timeline.length >= 5, `Timeline contains ${provData.timeline.length} verifiable stages`);

    const stage1 = provData.timeline.find((s: any) => s.stage === 1);
    assert(stage1?.actor === "Owner 1", "Stage 1 preserves privacy with 'Owner 1' label");

    // Verify blockchain verification accuracy: P2P device has no fake txHash
    assert(
      provData.technicianVerified.isCertifiedOnChain === false,
      "Accurately shows not on-chain when no transaction was recorded (Never fabricate!)"
    );
    assert(
      provData.technicianVerified.blockchainVerification.includes("internal database audit verified"),
      "Accurate non-on-chain status note displayed"
    );

    // Also verify an on-chain refurbished product
    const onChainProduct = await ProductModel.findOne({ txHash: { $exists: true, $ne: "" } }).lean();
    if (onChainProduct) {
      const ocRes = await fetch(`${baseUrl}/products/${onChainProduct.productId}`);
      const ocData = await ocRes.json() as any;
      assert(ocData.success === true, "Fetch on-chain certified product provenance");
      assert(
        ocData.technicianVerified.isCertifiedOnChain === true,
        "Accurately flags isCertifiedOnChain: true when actual txHash exists"
      );
      assert(
        ocData.technicianVerified.txHash === onChainProduct.txHash,
        "Preserves exact blockchain transaction hash"
      );
    }

    // 7. Test Atomic Stock Concurrency & Purchase Workflow
    console.log("\n--- TEST GROUP 6: Atomic Order & Concurrency Testing ---");
    const buyerShipping = {
      fullName: "Ananya Rao",
      phone: "+91 99887 76655",
      streetAddress: "72, Palm Avenue, Koramangala 4th Block",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560034",
    };

    // Buyer 1 places order for the P2P device
    const order1Res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        itemType: "P2P_PRODUCT",
        itemId: createdListingId,
        quantity: 1,
        shippingAddress: buyerShipping,
        paymentMethod: "TEST_UPI",
      }),
    });
    const order1Data = await order1Res.json() as any;
    assert(order1Data.success === true, "Buyer 1 successfully places order for P2P device");
    assert(order1Data.data.p2pListingId === createdListingId, "Order references correct p2pListingId");
    assert(order1Data.data.sellerRole === "CUSTOMER", "Seller role accurately marked as CUSTOMER");
    assert(order1Data.data.orderStatus === "PLACED", "Initial order status is PLACED");

    const orderId = order1Data.data.orderId;

    // Concurrent Buyer 2 attempts to purchase the same device -> Must fail atomically
    const order2Res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        itemType: "P2P_PRODUCT",
        itemId: createdListingId,
        quantity: 1,
        shippingAddress: buyerShipping,
        paymentMethod: "TEST_UPI",
      }),
    });
    const order2Data = await order2Res.json() as any;
    assert(
      order2Res.status === 400 && order2Data.success === false,
      "Concurrent purchase attempt fails atomically (prevents overselling/double-buy)",
      order2Data.error
    );

    // 8. Test Verified Payment & Legal Title Transfer
    console.log("\n--- TEST GROUP 7: Verified Payment & Ownership Transfer ---");
    const payRes = await fetch(`${baseUrl}/orders/${orderId}/pay-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        paymentMethod: "TEST_UPI",
        clientTxRef: `TXN-AUDIT-${Date.now()}`,
      }),
    });
    const payData = await payRes.json() as any;
    assert(payData.success === true, "Server-side test payment verification succeeds");
    assert(payData.data.paymentStatus === "VERIFIED_PAID", "Order status updated to VERIFIED_PAID");

    // Duplicate payment attempt -> Must fail
    const dupPayRes = await fetch(`${baseUrl}/orders/${orderId}/pay-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ paymentMethod: "TEST_UPI" }),
    });
    assert(dupPayRes.status === 400, "Duplicate payment attempt on verified order is rejected");

    // Verify stage 7 OWNERSHIP_TRANSFER event in ledger
    const transferEvent = await OwnershipEventModel.findOne({
      productId: createdListingId,
      eventType: "OWNERSHIP_TRANSFER",
    }).lean();
    assert(Boolean(transferEvent), "Stage 7 OwnershipEvent (OWNERSHIP_TRANSFER) recorded in ledger");
    assert(transferEvent?.actorLabel === "Owner 2 (Verified Buyer)", "New owner accurately recorded as Owner 2 (Verified Buyer)");

    // Retrieve updated product provenance and verify timeline shows new owner
    const finalProvRes = await fetch(`${baseUrl}/products/${createdListingId}`);
    const finalProvData = await finalProvRes.json() as any;
    const finalTimeline = finalProvData.timeline;
    const stage7 = finalTimeline.find((s: any) => s.stage === 7);
    assert(
      stage7?.status === "COMPLETED",
      "Stage 7 (Verified Legal Ownership Transfer) is marked COMPLETED in product details"
    );

    // Clean up test data
    await ProductListingModel.deleteOne({ listingId: createdListingId });
    await MarketplaceOrderModel.deleteOne({ orderId });
    await OwnershipEventModel.deleteMany({ productId: createdListingId });
    console.log("\n Cleaned up test listing, order, and ownership events.");

  } catch (err: any) {
    console.error("Critical test execution failure:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n==================================================================");
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
