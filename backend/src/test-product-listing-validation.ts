/**
 * ECOTRACE — PRODUCT LISTING DESCRIPTION VALIDATION & WORKFLOW TEST SUITE
 * 
 * Verifies:
 * 1. A valid description is submitted and stored correctly.
 * 2. A missing description produces a clear HTTP 400 validation error.
 * 3. A whitespace-only description is rejected with HTTP 400.
 * 4. A description containing punctuation and normal Unicode characters is preserved correctly.
 * 5. Both 'description' and 'generalDescription' request properties are supported.
 * 6. A successful listing retains the existing inspection/review workflow (PENDING_INSPECTION).
 * 7. Existing marketplace listings, approval, and privacy protections continue to work.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import jwt from "jsonwebtoken";
import { UserModel, ProductListingModel, OwnershipEventModel } from "./models";

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/ecotrace";
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/marketplace`;
const JWT_SECRET = process.env.JWT_SECRET || "ecotrace_jwt_secret_dev_key_2026";

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

async function runValidationTests() {
  console.log("=======================================================================");
  console.log("   ECOTRACE — PRODUCT LISTING DESCRIPTION VALIDATION TEST SUITE        ");
  console.log("=======================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", mongoose.connection.name);

  const cleanupListingIds: string[] = [];

  try {
    // 1. Authenticate as a Customer
    let customer = await UserModel.findOne({ role: "CUSTOMER" });
    if (!customer) {
      customer = await UserModel.create({
        fullName: "Ananya Sharma",
        email: `test-cust-${Date.now()}@ecotrace.test`,
        password: "HashedPassword123!",
        role: "CUSTOMER",
        status: "APPROVED",
        phone: "+91 98765 43210",
      });
    }

    const customerToken = jwt.sign(
      {
        id: customer._id.toString(),
        email: customer.email,
        role: customer.role,
        fullName: customer.fullName,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    };

    // -------------------------------------------------------------------------
    // TEST 1: Valid Description Submitted and Stored Correctly
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Valid Description Submission and Storage");
    const validPayload = {
      title: "Dell XPS 13 9310 Ultrabook",
      category: "Laptops & Computers",
      brand: "Dell",
      model: "XPS 13 9310",
      ageYears: 2,
      condition: "WORKING",
      expectedPrice: 48000,
      description: "Gently used Dell XPS 13 with 16GB RAM and 512GB NVMe SSD. Original charger and box included.",
      damageDetails: "No visible scratches on display; minor cosmetic wear on base rubber feet.",
      accessories: ["Charger / Power Adapter", "Original Packaging Box"],
      pickupAddress: "142 5th Main, Indiranagar, Bengaluru 560038",
      approximateLocation: "Indiranagar, Bengaluru",
    };

    const res1 = await fetch(`${BASE_URL}/listings`, {
      method: "POST",
      headers,
      body: JSON.stringify(validPayload),
    });
    const data1 = (await res1.json()) as any;

    assert(res1.status === 201, "Valid listing returns HTTP 201 Created", res1.status);
    assert(data1.success === true, "Response reports success: true");
    assert(Boolean(data1.data?.listingId), "Listing ID is generated", data1.data?.listingId);

    const listing1Id = data1.data?.listingId;
    if (listing1Id) cleanupListingIds.push(listing1Id);

    // Verify stored document in MongoDB
    const storedDoc1 = await ProductListingModel.findOne({ listingId: listing1Id }).lean();
    assert(Boolean(storedDoc1), "Listing is persisted in MongoDB");
    assert(
      storedDoc1?.description === validPayload.description,
      "Stored description exactly matches submitted text",
      storedDoc1?.description
    );

    // -------------------------------------------------------------------------
    // TEST 2: Missing Description Produces Clear HTTP 400 Validation Error
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Missing Description Validation Error");
    const missingDescPayload = {
      title: "MacBook Pro 14 M1 Pro",
      category: "Laptops & Computers",
      brand: "Apple",
      model: "A2442",
      ageYears: 2,
      condition: "WORKING",
      expectedPrice: 85000,
      // description omitted completely
    };

    const res2 = await fetch(`${BASE_URL}/listings`, {
      method: "POST",
      headers,
      body: JSON.stringify(missingDescPayload),
    });
    const data2 = (await res2.json()) as any;

    assert(res2.status === 400, "Missing description returns HTTP 400 Bad Request", res2.status);
    assert(data2.success === false, "Missing description reports success: false");
    assert(
      typeof data2.error === "string" && data2.error.toLowerCase().includes("description"),
      "Error message clearly identifies description as required",
      data2.error
    );

    // Also verify empty string description produces HTTP 400
    const emptyDescPayload = { ...missingDescPayload, description: "" };
    const res2b = await fetch(`${BASE_URL}/listings`, {
      method: "POST",
      headers,
      body: JSON.stringify(emptyDescPayload),
    });
    const data2b = (await res2b.json()) as any;
    assert(res2b.status === 400, "Empty string description returns HTTP 400 Bad Request", res2b.status);
    assert(
      typeof data2b.error === "string" && data2b.error.toLowerCase().includes("description"),
      "Empty string error message specifies description is mandatory",
      data2b.error
    );

    // -------------------------------------------------------------------------
    // TEST 3: Whitespace-Only Description is Rejected (HTTP 400)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Whitespace-Only Description Rejection");
    const whitespacePayloads = [
      "   ",
      "\t\t  \n  ",
      "                 ",
    ];

    for (const ws of whitespacePayloads) {
      const res3 = await fetch(`${BASE_URL}/listings`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...validPayload,
          title: "Lenovo ThinkPad X1 Carbon",
          description: ws,
        }),
      });
      const data3 = (await res3.json()) as any;
      assert(
        res3.status === 400,
        `Whitespace-only description '${JSON.stringify(ws)}' returns HTTP 400`,
        res3.status
      );
      assert(
        data3.success === false && typeof data3.error === "string" && data3.error.toLowerCase().includes("description"),
        "Whitespace-only error clearly specifies description is required",
        data3.error
      );
    }

    // -------------------------------------------------------------------------
    // TEST 4: Punctuation and Unicode Characters Preserved Correctly
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Punctuation and Unicode Preservation");
    const unicodeDescription =
      'Lenovo ThinkPad X1 Carbon Gen 9 — 14" WUXGA (1920×1200) IPS display; 100% sRGB! Battery health: ≥92%, holds 6.5h charge. Clean keyboard (no sheen/wear). Includes 65W GaN USB-C™ adapter & protective sleeve. Price is ₹52,000 (OBO) 🚀.';

    const unicodePayload = {
      ...validPayload,
      title: "Lenovo ThinkPad X1 Carbon Gen 9",
      brand: "Lenovo",
      model: "ThinkPad X1 Carbon Gen 9",
      description: unicodeDescription,
    };

    const res4 = await fetch(`${BASE_URL}/listings`, {
      method: "POST",
      headers,
      body: JSON.stringify(unicodePayload),
    });
    const data4 = (await res4.json()) as any;

    assert(res4.status === 201, "Unicode description listing returns HTTP 201 Created", res4.status);
    const listing4Id = data4.data?.listingId;
    if (listing4Id) cleanupListingIds.push(listing4Id);

    const storedDoc4 = await ProductListingModel.findOne({ listingId: listing4Id }).lean();
    assert(
      storedDoc4?.description === unicodeDescription,
      "Unicode description preserves all special characters (—, \", ×, ≥, ™, ₹, 🚀, etc.)",
      storedDoc4?.description
    );

    // -------------------------------------------------------------------------
    // TEST 5: Flexible Field Mapping ('generalDescription' alias)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Flexible Field Mapping (generalDescription alias)");
    const generalDescPayload = {
      title: "HP Spectre x360 Convertible",
      category: "Laptops & Computers",
      brand: "HP",
      model: "Spectre x360 14",
      ageYears: 1,
      condition: "WORKING",
      expectedPrice: 65000,
      generalDescription: "Premium convertible 2-in-1 laptop with OLED touch screen and stylus pen included.",
      damageDetails: "Flawless condition; protective vinyl skin applied since day one.",
    };

    const res5 = await fetch(`${BASE_URL}/listings`, {
      method: "POST",
      headers,
      body: JSON.stringify(generalDescPayload),
    });
    const data5 = (await res5.json()) as any;

    assert(res5.status === 201, "Payload using generalDescription returns HTTP 201 Created", res5.status);
    const listing5Id = data5.data?.listingId;
    if (listing5Id) cleanupListingIds.push(listing5Id);

    const storedDoc5 = await ProductListingModel.findOne({ listingId: listing5Id }).lean();
    assert(
      storedDoc5?.description === generalDescPayload.generalDescription,
      "Mongoose schema mapped generalDescription property to description field",
      storedDoc5?.description
    );

    // -------------------------------------------------------------------------
    // TEST 6: Retains Inspection / Review Workflow & Lifecycle Stage 1 Event
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Inspection/Review Lifecycle and Ownership Event Verification");
    assert(
      storedDoc1?.status === "PENDING_INSPECTION",
      "New listing initial status is PENDING_INSPECTION (prevents unauthorized uninspected publishing)"
    );

    const initialEvent = await OwnershipEventModel.findOne({
      productId: listing1Id,
      eventType: "ORIGINAL_LISTING",
    }).lean();

    assert(Boolean(initialEvent), "Stage 1 OwnershipEvent (ORIGINAL_LISTING) recorded in lifecycle ledger");
    assert(
      initialEvent?.actorRole === "CUSTOMER",
      "Ownership event actorRole is CUSTOMER"
    );
    assert(
      initialEvent?.actorLabel === "Owner 1",
      "Privacy-preserving actorLabel is 'Owner 1'"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Customer Retrieve Own Listings (GET /api/marketplace/listings/my)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] My Listings API Returns Created Listings with Description");
    const res7 = await fetch(`${BASE_URL}/listings/my`, { headers });
    const data7 = (await res7.json()) as any;

    assert(res7.status === 200, "GET /api/marketplace/listings/my returns HTTP 200");
    assert(data7.success === true, "Response reports success: true");
    const listings = Array.isArray(data7.data) ? data7.data : data7.data?.listings;
    assert(Array.isArray(listings), "Returns listings array");

    const foundListing = listings?.find((l: any) => l.listingId === listing1Id);
    assert(Boolean(foundListing), "Customer can retrieve their newly created listing");
    assert(
      foundListing?.description === validPayload.description,
      "Retrieved listing preserves description field accurately"
    );

  } catch (err: any) {
    console.error("Test execution threw unexpected exception:", err);
    failed++;
  } finally {
    // Clean up created test listings
    if (cleanupListingIds.length > 0) {
      console.log(`\nCleaning up ${cleanupListingIds.length} test listings...`);
      await ProductListingModel.deleteMany({ listingId: { $in: cleanupListingIds } });
      await OwnershipEventModel.deleteMany({ productId: { $in: cleanupListingIds } });
    }
    await mongoose.disconnect();
  }

  console.log("\n=======================================================================");
  console.log(`VALIDATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidationTests();
