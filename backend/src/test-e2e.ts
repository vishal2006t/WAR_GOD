import http from "http";

const API_BASE = "http://localhost:5000";

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data: any = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("=== ECOTRACE END-TO-END AUTOMATED VERIFICATION ===");

  // 1. Health check & Environment Audit
  const health = await request("/health");
  console.log(
    "[1] Health Check & Environment Audit:",
    health.data.status === "healthy" && health.data.database.type === "PostgreSQL"
      ? `PASS (DB: ${health.data.database.type}, QpiAI Mode: ${health.data.qpiaiOpt.mode})`
      : "FAIL"
  );

  // 2. Auth: Test 6 Role Logins
  const roles = [
    { email: "admin@ecotrace.org", role: "ADMIN", portalRole: "ADMIN" },
    { email: "dealer@metrocollect.com", role: "DEALER", portalRole: "DEALER" },
    { email: "driver@greenlogistics.com", role: "DRIVER", portalRole: "DRIVER" },
    { email: "factory@apexrecycling.com", role: "FACTORY", portalRole: "FACTORY" },
    { email: "worker@apexrecycling.com", role: "WORKER", portalRole: "WORKER" },
    { email: "customer@ecotrace.org", role: "CUSTOMER", portalRole: "CUSTOMER" },
  ];

  const tokens: Record<string, string> = {};

  for (const r of roles) {
    const loginRes = await request("/api/auth/login", {
      method: "POST",
      body: { email: r.email, password: "password123", portalRole: r.portalRole },
    });
    if (loginRes.ok && loginRes.data.token) {
      tokens[r.role] = loginRes.data.token;
      console.log(`[2] Login ${r.role} (${r.email}): PASS`);
    } else {
      console.error(`[2] Login ${r.role} FAILED:`, loginRes.data);
    }
  }

  // 3. Test Negative: Role Mismatch Login Protection
  const mismatchRes = await request("/api/auth/login", {
    method: "POST",
    body: { email: "dealer@metrocollect.com", password: "password123", portalRole: "ADMIN" },
  });
  console.log(
    "[3] Portal Role Mismatch Protection:",
    mismatchRes.status === 403 ? "PASS (Blocked)" : "FAIL"
  );

  // 4. Test Dealer Batch Registration
  const categoriesRes = await request("/api/batches/categories");
  const facilitiesRes = await request("/api/batches/facilities");
  const catId = categoriesRes.data.categories[0].id;
  const facId = facilitiesRes.data.facilities[0].id;

  const batchRes = await request("/api/batches", {
    method: "POST",
    token: tokens["DEALER"],
    body: {
      categoryId: catId,
      destinationFacilityId: facId,
      pickupLocation: "Test Hub Bengaluru",
      sourceType: "Industrial Automation",
      description: "Decommissioned high-grade PCB boards and compute nodes",
      initialWeightKg: 120.0,
    },
  });
  console.log("[4] Dealer Batch Registration:", batchRes.ok ? `PASS (${batchRes.data.batch.batchId})` : "FAIL");

  // 5. Test Mass Balance Validation: Success case (100 = 80 recovered + 15 residual + 5 loss)
  // First fetch an existing batch ready for processing
  const availBatches = await request("/api/processing/available-batches", { token: tokens["WORKER"] });
  if (availBatches.data.batches && availBatches.data.batches.length > 0) {
    const targetBatch = availBatches.data.batches[0];
    const procRes = await request("/api/processing", {
      method: "POST",
      token: tokens["WORKER"],
      body: {
        sourceBatchId: targetBatch.id,
        inputWeightKg: targetBatch.initialWeightKg,
        materials: [
          { materialType: "Copper Cathode", weightKg: targetBatch.initialWeightKg * 0.4 },
          { materialType: "Recycled Aluminum", weightKg: targetBatch.initialWeightKg * 0.35 },
        ],
        residualKg: targetBatch.initialWeightKg * 0.2,
        documentedLossKg: targetBatch.initialWeightKg * 0.05,
      },
    });
    console.log("[5] Processing & Mass Balance Reconciliation:", procRes.ok ? `PASS (Yield: ${procRes.data.massBalance.recoveryYieldPercentage}%)` : "FAIL");
  }

  // 6. Test Negative: Mass Balance Mismatch (unbalanced quantities)
  const failMb = await request("/api/processing", {
    method: "POST",
    token: tokens["WORKER"],
    body: {
      sourceBatchId: batchRes.data.batch.id,
      inputWeightKg: 120.0,
      materials: [{ materialType: "Copper", weightKg: 50.0 }],
      residualKg: 20.0,
      documentedLossKg: 5.0, // 50 + 20 + 5 = 75 != 120 (45kg missing!)
    },
  });
  console.log(
    "[6] Negative Test - Mass Balance Mismatch Rejection:",
    failMb.status === 422 ? "PASS (Rejected unbalanced record)" : "FAIL"
  );

  // 7. Test Duplicate/Excessive Claim Prevention
  const materialsList = await request("/api/materials", { token: tokens["ADMIN"] });
  if (materialsList.data.materials && materialsList.data.materials.length > 0) {
    const mat = materialsList.data.materials[0];
    // Attempt claim larger than available weight
    const overClaim = await request("/api/materials/claim", {
      method: "POST",
      token: tokens["CUSTOMER"],
      body: {
        materialBatchId: mat.id,
        claimedWeightKg: mat.recoveredWeightKg * 2, // 200% of available!
        claimantName: "Malicious Double Claimant",
        claimantOrg: "Double Count Corp",
      },
    });
    console.log(
      "[7] Negative Test - Duplicate/Excessive Claim Rejection:",
      overClaim.status === 400 ? "PASS (Blocked double-claim)" : "FAIL"
    );
  }

  // 8. Test Public Customer Verification (Product ID and Serial Number)
  const verifyById = await request("/api/products/verify/PROD-REFURB-001");
  console.log(
    "[8] Public Verification by Product ID:",
    verifyById.ok && verifyById.data.status === "VERIFIED" ? `PASS (${verifyById.data.product.name})` : "FAIL"
  );

  const verifyBySerial = await request("/api/products/verify/SN-DELL-883921");
  console.log(
    "[9] Public Verification by Serial Number:",
    verifyBySerial.ok && verifyBySerial.data.status === "VERIFIED" ? `PASS (${verifyBySerial.data.product.condition})` : "FAIL"
  );

  // 10. Test Admin Analytics Live Aggregation
  const analyticsRes = await request("/api/admin/analytics", { token: tokens["ADMIN"] });
  console.log(
    "[10] Admin Live Metrics Aggregation:",
    analyticsRes.ok && analyticsRes.data.metrics.totalBatches > 0
      ? `PASS (${analyticsRes.data.metrics.totalBatches} batches, ${analyticsRes.data.metrics.totalCollectedWeightKg} kg collected)`
      : "FAIL"
  );

  // 11. Test QpiAI Opt / Heuristic Route Optimization
  const routeRes = await request("/api/dispatches/optimize-routes", { token: tokens["DRIVER"] });
  console.log(
    "[11] Dispatch Route Optimization Engine:",
    routeRes.ok && routeRes.data.optimization.status === "OPTIMIZED"
      ? `PASS (Engine: ${routeRes.data.optimization.engine}, Est. Savings: ${routeRes.data.optimization.co2SavingsKg} kg CO2e)`
      : "FAIL"
  );

  console.log("=== ALL END-TO-END BACKEND INTEGRATION TESTS COMPLETED ===");
}

runTests().catch(console.error);
