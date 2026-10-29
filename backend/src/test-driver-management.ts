const API_BASE = "http://localhost:5000/api";

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: number, name: string, passed: boolean, details: string) {
  results.push({ step, name, passed, details });
  const statusStr = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[Step ${step}] ${statusStr} — ${name}: ${details}`);
}

async function request(path: string, options: any = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
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

async function runDriverManagementVerification() {
  console.log("================================================================================");
  console.log(" ECOTRACE DRIVER MANAGEMENT & DEALER WORKFLOW INTEGRATION VERIFICATION");
  console.log(" Kali Linux Workspace | MongoDB | Express | Role Authorization | Safe Deletion");
  console.log("================================================================================\n");

  // Authenticate Dealer, Admin, and Customer
  const dealerLogin = await request("/auth/login", {
    method: "POST",
    body: { email: "dealer@metrocollect.com", password: "password123", portalRole: "DEALER" },
  });
  const dealerToken = dealerLogin.data?.token;

  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@ecotrace.org", password: "password123", portalRole: "ADMIN" },
  });
  const adminToken = adminLogin.data?.token;

  const customerLogin = await request("/auth/login", {
    method: "POST",
    body: { email: "customer@ecotrace.org", password: "password123", portalRole: "CUSTOMER" },
  });
  const customerToken = customerLogin.data?.token;

  // Step 1: List drivers as Dealer
  const listRes = await request("/drivers", { token: dealerToken });
  const initialDrivers = listRes.data?.drivers || [];
  record(
    1,
    "Authorized Dealer can list fleet drivers",
    listRes.ok && initialDrivers.length > 0,
    `Retrieved ${initialDrivers.length} registered drivers from MongoDB`
  );

  // Step 2: Add a new driver with complete vehicle specs
  const testDriverId = `DRV-TEST-${Date.now().toString().slice(-4)}`;
  const testPlate = `KA-04-TEST-${Date.now().toString().slice(-4)}`;
  const addRes = await request("/drivers", {
    method: "POST",
    token: dealerToken,
    body: {
      fullName: "Arunodoy Sen (Green Hauler)",
      driverId: testDriverId,
      email: `arunodoy.${Date.now()}@greenlogistics.com`,
      phone: "+91 98888 11223",
      licenseNumber: "DL-KA-04-2022-7711",
      vehicleType: "Medium Transit Electric Van",
      vehicleRegistration: testPlate,
      loadCapacityKg: 1800,
      availability: "AVAILABLE",
      notes: "Dedicated regional collection van with GPS telematics",
    },
  });
  const addedDriver = addRes.data?.driver;
  record(
    2,
    "Dealer can register new fleet driver with vehicle details & capacity",
    addRes.status === 201 && !!addedDriver?.id,
    `Driver ${addedDriver?.fullName} (${addedDriver?.driverId}) registered with ${addedDriver?.loadCapacityKg}kg capacity`
  );

  // Step 3: Prevent duplicate driver ID
  const dupIdRes = await request("/drivers", {
    method: "POST",
    token: dealerToken,
    body: {
      fullName: "Duplicate ID Test",
      driverId: testDriverId,
      email: "dup.id@greenlogistics.com",
      phone: "+91 98888 00000",
      vehicleType: "Light Van",
      vehicleRegistration: "KA-01-DUP-01",
      loadCapacityKg: 1000,
    },
  });
  record(
    3,
    "Duplicate driver ID registration is strictly rejected",
    dupIdRes.status === 400 && !dupIdRes.ok,
    `HTTP 400 returned: "${dupIdRes.data?.error}"`
  );

  // Step 4: Prevent duplicate vehicle registration
  const dupRegRes = await request("/drivers", {
    method: "POST",
    token: dealerToken,
    body: {
      fullName: "Duplicate Reg Test",
      driverId: `DRV-DIFF-${Date.now().toString().slice(-4)}`,
      email: "dup.reg@greenlogistics.com",
      phone: "+91 98888 00001",
      vehicleType: "Light Van",
      vehicleRegistration: testPlate,
      loadCapacityKg: 1000,
    },
  });
  record(
    4,
    "Duplicate vehicle registration plate is strictly rejected",
    dupRegRes.status === 400 && !dupRegRes.ok,
    `HTTP 400 returned: "${dupRegRes.data?.error}"`
  );

  // Step 5: Retrieve driver details with calculated statistics
  const detailsRes = await request(`/drivers/${testDriverId}`, { token: dealerToken });
  const details = detailsRes.data?.driver;
  const statsOk = details && details.stats && details.stats.totalDispatches !== undefined;
  record(
    5,
    "Driver details endpoint returns profile, specs, and real performance metrics",
    detailsRes.ok && statsOk,
    `Driver ${details?.driverId}: Total Dispatches: ${details?.stats?.totalDispatches}, Completion Rate: ${details?.stats?.completionRate}%`
  );

  // Step 6: Update driver profile
  const updateRes = await request(`/drivers/${testDriverId}`, {
    method: "PUT",
    token: dealerToken,
    body: {
      phone: "+91 98888 99999",
      notes: "Updated telemetry: High-speed DC fast-charge capable",
      loadCapacityKg: 2200,
    },
  });
  const updatedDriver = updateRes.data?.driver;
  record(
    6,
    "Dealer can update driver profile and payload capacity",
    updateRes.ok && updatedDriver?.loadCapacityKg === 2200,
    `Updated phone to ${updatedDriver?.phone} and capacity to ${updatedDriver?.loadCapacityKg}kg`
  );

  // Step 7: Change driver availability to MAINTENANCE
  const availRes = await request(`/drivers/${testDriverId}/availability`, {
    method: "PATCH",
    token: dealerToken,
    body: { availability: "MAINTENANCE" },
  });
  record(
    7,
    "Dealer can change driver availability status",
    availRes.ok && availRes.data?.driver?.availability === "MAINTENANCE",
    `Availability updated to ${availRes.data?.driver?.availability}`
  );

  // Fetch real category and facility
  const catRes = await request("/batches/categories");
  const facRes = await request("/batches/facilities");
  const categoryId = catRes.data?.categories?.[0]?.id || "CAT-PCB-01";
  const destinationFacilityId = facRes.data?.facilities?.[0]?.id || "FAC-APEX-01";

  // Step 8: Validate dispatch rejects unavailable driver
  // Create a pending batch
  const batchRes = await request("/batches", {
    method: "POST",
    token: dealerToken,
    body: {
      categoryId,
      destinationFacilityId,
      pickupLocation: "Electronic City Depot 4, Hosur Rd, Bengaluru",
      pickupAddress: "Electronic City Depot 4, Hosur Rd, Bengaluru",
      contactPhone: "+91 98450 12345",
      contactEmail: "collector@ecotrace.network",
      sourceType: "Enterprise Server Intake",
      description: "Decommissioned server power supplies and PCBs",
      initialWeightKg: 100,
    },
  });
  const testBatch = batchRes.data?.batch;
  const testBatchId = testBatch?.id || testBatch?._id || testBatch?.batchId;

  const unavailDispatchRes = await request("/dispatches", {
    method: "POST",
    token: dealerToken,
    body: {
      batchIds: [testBatchId],
      driverId: addedDriver.id,
      vehicleRegistration: testPlate,
      pickupAddress: "Electronic City Depot 4, Bengaluru",
      destinationFacilityId,
    },
  });
  record(
    8,
    "Dispatch creation rejects unavailable driver (MAINTENANCE/ON_TRIP/OFF_DUTY)",
    unavailDispatchRes.status === 400 && !unavailDispatchRes.ok,
    `HTTP 400 returned: "${unavailDispatchRes.data?.error}"`
  );

  // Restore availability to AVAILABLE
  await request(`/drivers/${testDriverId}/availability`, {
    method: "PATCH",
    token: dealerToken,
    body: { availability: "AVAILABLE" },
  });

  // Step 9: Validate dispatch rejects over-capacity batch
  // Create an over-capacity batch (e.g. 3500kg for a 2200kg capacity vehicle)
  const heavyBatchRes = await request("/batches", {
    method: "POST",
    token: dealerToken,
    body: {
      categoryId,
      destinationFacilityId,
      pickupLocation: "Heavy Industrial Aggregator Hub, Peenya",
      pickupAddress: "Heavy Industrial Aggregator Hub, Peenya",
      contactPhone: "+91 98450 12345",
      contactEmail: "collector@ecotrace.network",
      sourceType: "Bulk Transformer Scrapping",
      description: "Industrial transformers and heavy induction coils",
      initialWeightKg: 3500, // Exceeds 2200kg capacity
    },
  });
  const heavyBatch = heavyBatchRes.data?.batch;
  const heavyBatchId = heavyBatch?.id || heavyBatch?._id || heavyBatch?.batchId;

  const overCapDispatchRes = await request("/dispatches", {
    method: "POST",
    token: dealerToken,
    body: {
      batchIds: [heavyBatchId],
      driverId: addedDriver.id,
      vehicleRegistration: testPlate,
      pickupAddress: "Heavy Industrial Aggregator Hub, Peenya",
      destinationFacilityId,
    },
  });
  record(
    9,
    "Dispatch creation rejects assignment when batch weight exceeds vehicle payload capacity",
    overCapDispatchRes.status === 400 && !overCapDispatchRes.ok,
    `HTTP 400 returned: "${overCapDispatchRes.data?.error}"`
  );

  // Step 10: Create valid dispatch and verify driver availability changes to ON_TRIP
  const validDispatchRes = await request("/dispatches", {
    method: "POST",
    token: dealerToken,
    body: {
      batchIds: [testBatchId],
      driverId: addedDriver.id,
      vehicleRegistration: testPlate,
      pickupAddress: "Electronic City Depot 4, Bengaluru",
      destinationFacilityId,
    },
  });
  const createdDispatch = validDispatchRes.data?.dispatch;
  const driverAfterDispatch = (await request(`/drivers/${testDriverId}`, { token: dealerToken })).data?.driver;
  record(
    10,
    "Successful dispatch updates driver availability to ON_TRIP and links assignment",
    validDispatchRes.ok && driverAfterDispatch?.availability === "ON_TRIP",
    `Dispatch ${createdDispatch?.dispatchId} created; Driver status: ${driverAfterDispatch?.availability}`
  );

  // Step 11: Prevent safe deletion of driver with historical dispatches
  const deleteBlockedRes = await request(`/drivers/${testDriverId}`, {
    method: "DELETE",
    token: dealerToken,
  });
  record(
    11,
    "Safe deletion prevents removing a driver with active or historical shipments",
    deleteBlockedRes.status === 400 && !deleteBlockedRes.ok,
    `HTTP 400 returned: "${deleteBlockedRes.data?.error}"`
  );

  // Step 12: Allow safe deletion on a driver with no dispatches
  const cleanDriverId = `DRV-CLEAN-${Date.now().toString().slice(-4)}`;
  const cleanDriverPlate = `KA-01-CLN-${Date.now().toString().slice(-4)}`;
  await request("/drivers", {
    method: "POST",
    token: dealerToken,
    body: {
      fullName: "Temporary Test Driver",
      driverId: cleanDriverId,
      email: `temp.${Date.now()}@greenlogistics.com`,
      phone: "+91 98888 77777",
      vehicleType: "Light Van",
      vehicleRegistration: cleanDriverPlate,
      loadCapacityKg: 1000,
    },
  });
  const deleteCleanRes = await request(`/drivers/${cleanDriverId}`, {
    method: "DELETE",
    token: dealerToken,
  });
  record(
    12,
    "Safe deletion allows removing a driver without any linked shipments",
    deleteCleanRes.ok,
    `HTTP 200 returned: "${deleteCleanRes.data?.message}"`
  );

  // Step 13: Unauthorized role access blocked by backend
  const customerListRes = await request("/drivers", { token: customerToken });
  const customerCreateRes = await request("/drivers", {
    method: "POST",
    token: customerToken,
    body: { fullName: "Hacker", email: "hack@bad.com", phone: "+91 00000000", vehicleType: "Van", vehicleRegistration: "BAD-01", loadCapacityKg: 1000 },
  });
  const unauthorizedBlocked = customerListRes.status === 403 && customerCreateRes.status === 403;
  record(
    13,
    "Unauthorized role access (e.g. CUSTOMER) is blocked from driver management endpoints",
    unauthorizedBlocked,
    `GET /drivers -> HTTP ${customerListRes.status}; POST /drivers -> HTTP ${customerCreateRes.status}`
  );

  console.log("\n================================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(` DRIVER MANAGEMENT VERIFICATION: ${totalPassed} / ${results.length} CHECKS PASSED`);
  console.log("================================================================================");
}

runDriverManagementVerification().catch(console.error);
