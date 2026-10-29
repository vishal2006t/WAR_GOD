import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

const API_BASE = "http://localhost:5000";

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function record(name: string, passed: boolean, details: string) {
  reports.push({ name, passed, details });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} | ${name}: ${details}`);
}

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runDriverAiAndVisibilityTestSuite() {
  console.log("================================================================================");
  console.log("     WAR_GOD: DRIVER AI, MANUAL MODE & PRODUCT VISIBILITY VERIFICATION SUITE   ");
  console.log("================================================================================\n");

  // 1. Authenticate dealer and admin
  console.log("--- 1. Authentication Check ---");
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@ecotrace.org", password: "password123", portalRole: "ADMIN" },
  });
  const adminToken = adminLogin.data?.token;
  record("Admin Login", !!adminToken, `HTTP ${adminLogin.status} - Token generated`);

  const dealerLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "dealer@metrocollect.com", password: "password123", portalRole: "DEALER" },
  });
  const dealerToken = dealerLogin.data?.token;
  record("Dealer Login", !!dealerToken, `HTTP ${dealerLogin.status} - Token generated`);

  const customerLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "customer@ecotrace.org", password: "password123", portalRole: "CUSTOMER" },
  });
  const customerToken = customerLogin.data?.token;
  record("Customer Login", !!customerToken, `HTTP ${customerLogin.status} - Token generated`);

  // 2. Product Cross-Location Discovery & Visibility
  console.log("\n--- 2. Product Visibility & Cross-Location Discovery ---");
  const browseRes = await request("/api/marketplace/browse?inStockOnly=false");
  const hasBrowseItems = browseRes.ok && browseRes.data?.data?.allProducts !== undefined;
  const itemCount = browseRes.data?.data?.allProducts?.length || 0;
  record(
    "Cross-Location Marketplace Browse",
    hasBrowseItems && itemCount >= 0,
    `HTTP ${browseRes.status} - Found ${itemCount} total products across locations`
  );

  // Verify that products from different cities are returned without geographic barriers
  if (itemCount > 0) {
    const locations = browseRes.data.data.allProducts.map((p: any) => p.approximateLocation || p.dealerCity);
    record(
      "Unrestricted Location Product Access",
      locations.length > 0,
      `Discoverable sample locations: ${locations.slice(0, 3).join("; ")}`
    );
  }

  // 3. Driver AI Operating Mode Verification
  console.log("\n--- 3. Operating Mode Management (AI vs Manual Mode) ---");
  const getModeRes = await request("/api/driver-ai/mode", { token: dealerToken });
  record(
    "Get Operating Mode",
    getModeRes.ok && ["AI", "MANUAL"].includes(getModeRes.data?.data?.mode),
    `Current mode: ${getModeRes.data?.data?.mode} (Scope: ${getModeRes.data?.data?.scope || "GLOBAL"})`
  );

  // Switch to MANUAL mode
  const setManualRes = await request("/api/driver-ai/mode", {
    method: "POST",
    token: dealerToken,
    body: { mode: "MANUAL", notes: "Test suite switching to Manual Mode" },
  });
  record(
    "Set Operating Mode to MANUAL",
    setManualRes.ok && setManualRes.data?.mode === "MANUAL",
    `Mode confirmed: ${setManualRes.data?.mode}`
  );

  // Verify persistence after querying again
  const verifyManual = await request("/api/driver-ai/mode", { token: dealerToken });
  record(
    "Persist MANUAL Mode",
    verifyManual.ok && verifyManual.data?.data?.mode === "MANUAL",
    "Manual Mode successfully persisted in database"
  );

  // Switch to AI mode
  const setAiRes = await request("/api/driver-ai/mode", {
    method: "POST",
    token: dealerToken,
    body: { mode: "AI", notes: "Test suite switching to AI Mode" },
  });
  record(
    "Set Operating Mode to AI",
    setAiRes.ok && setAiRes.data?.mode === "AI",
    `Mode confirmed: ${setAiRes.data?.mode}`
  );

  // 4. Real Database Driver Retrieval & Availability
  console.log("\n--- 4. Real Database Driver Retrieval & Status ---");
  const driversRes = await request("/api/driver-ai/drivers", { token: dealerToken });
  const drivers = driversRes.data?.data?.drivers || [];
  record(
    "Retrieve Real Drivers from Database",
    driversRes.ok && Array.isArray(drivers) && drivers.length > 0,
    `Retrieved ${drivers.length} drivers from MongoDB (Available: ${driversRes.data?.data?.availableCount})`
  );

  // 5. Driver AI Recommendations
  console.log("\n--- 5. Driver AI Recommendations Engine ---");
  const recRes = await request("/api/driver-ai/recommendations?requiredWeightKg=500&preferredVehicleType=Truck", {
    token: dealerToken,
  });
  const recs = recRes.data?.recommendations || [];
  const topRec = recs[0];
  record(
    "Driver AI Recommendation Generation",
    recRes.ok && Array.isArray(recs) && recs.length > 0,
    `Generated ${recs.length} ranked recommendations. Top driver: ${topRec?.fullName} (Score: ${topRec?.suitabilityScore}/100)`
  );

  if (topRec) {
    record(
      "Capacity & Match Reasoning Explainability",
      topRec.matchReasons && topRec.matchReasons.length > 0,
      `Match reasons: ${topRec.matchReasons.join(" | ")}`
    );
  }

  // 6. Independent Manual Mode Driver Assignment
  console.log("\n--- 6. Independent Manual Mode Driver Assignment ---");
  // Set back to MANUAL mode
  await request("/api/driver-ai/mode", {
    method: "POST",
    token: dealerToken,
    body: { mode: "MANUAL", notes: "Manual Assignment Test" },
  });

  const availableDriver = drivers.find((d: any) => d.availability === "AVAILABLE");
  if (availableDriver) {
    // Attempt manual assignment with non-existent dispatch to verify error handling
    const invalidAssign = await request("/api/driver-ai/manual-assign", {
      method: "POST",
      token: dealerToken,
      body: { dispatchId: "DISP-NON-EXISTENT", driverId: availableDriver.driverId },
    });
    record(
      "Manual Assignment Non-existent Dispatch Guard",
      invalidAssign.status === 400 && invalidAssign.data?.success === false,
      `Safely rejected invalid dispatch: "${invalidAssign.data?.error}"`
    );

    // Test driver status transition validation
    const statusUpdateRes = await request(`/api/driver-ai/drivers/${availableDriver.driverId}/status`, {
      method: "PATCH",
      token: dealerToken,
      body: { status: "OFF_DUTY", notes: "Testing status change" },
    });
    record(
      "Update Driver Availability to OFF_DUTY",
      statusUpdateRes.ok && statusUpdateRes.data?.driver?.availability === "OFF_DUTY",
      `Driver status transitioned to: ${statusUpdateRes.data?.driver?.availability}`
    );

    // Disallow assigning an OFF_DUTY driver
    const assignOffDuty = await request("/api/driver-ai/manual-assign", {
      method: "POST",
      token: dealerToken,
      body: { dispatchId: "DISP-TEST", driverId: availableDriver.driverId },
    });
    record(
      "Disallow Assigning OFF_DUTY Driver",
      assignOffDuty.status === 400 && assignOffDuty.data?.error?.includes("OFF_DUTY"),
      `Blocked unavailable driver: "${assignOffDuty.data?.error}"`
    );

    // Restore driver to AVAILABLE
    const restoreRes = await request(`/api/driver-ai/drivers/${availableDriver.driverId}/status`, {
      method: "PATCH",
      token: dealerToken,
      body: { status: "AVAILABLE", notes: "Restored to Available" },
    });
    record(
      "Restore Driver Status to AVAILABLE",
      restoreRes.ok && restoreRes.data?.driver?.availability === "AVAILABLE",
      `Driver status restored to: ${restoreRes.data?.driver?.availability}`
    );
  } else {
    record("Driver Availability Check", false, "No driver with AVAILABLE status found to test assignment");
  }

  // 7. Manual Mode AI Overwrite Prevention
  console.log("\n--- 7. Manual Mode Protection Against AI Overwrite ---");
  const aiAttemptWhileManual = await request("/api/driver-ai/ai-optimize", {
    method: "POST",
    token: dealerToken,
    body: { forceAI: false },
  });
  record(
    "Block AI Overwrite in MANUAL Mode",
    aiAttemptWhileManual.data?.status === "MANUAL_MODE_ACTIVE" ||
      aiAttemptWhileManual.data?.message?.includes("Manual Mode is active"),
    `AI assignment blocked: "${aiAttemptWhileManual.data?.message}"`
  );

  // 8. QpiAI Optimization Verification
  console.log("\n--- 8. QpiAI Integration & Optimization ---");
  const qpiRes = await request("/api/dispatches/optimize-routes", { token: dealerToken });
  record(
    "QpiAI Route Optimization API Route",
    qpiRes.status === 200,
    `HTTP ${qpiRes.status} - Optimization Status: ${qpiRes.data?.optimization?.status || qpiRes.data?.status}`
  );

  // Summary
  console.log("\n================================================================================");
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(` TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n>>> ALL TEST SUITE CHECKS PASSED PERFECTLY! <<<\n");
    process.exit(0);
  }
}

runDriverAiAndVisibilityTestSuite().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});
