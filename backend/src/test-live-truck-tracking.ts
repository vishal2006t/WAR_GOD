import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { DispatchModel, FacilityModel, NotificationModel, UserModel, DriverModel } from "./models";
import { DispatchStatus } from "./models/enums";

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

async function runLiveTruckTrackingTests() {
  console.log("================================================================================");
  console.log(" ECOTRACE LIVE TRUCK TRACKING & FACTORY ARRIVAL VERIFICATION TEST SUITE");
  console.log(" Node.js | TypeScript | Express | MongoDB | RBAC | Geofence | OTP Security");
  console.log("================================================================================\n");

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecotrace");
  }

  // 1. Authenticate all role personas
  const dealerRes = await request("/auth/login", {
    method: "POST",
    body: { email: "dealer@metrocollect.com", password: "password123", portalRole: "DEALER" },
  });
  const dealerToken = dealerRes.data?.token;

  const driverRes = await request("/auth/login", {
    method: "POST",
    body: { email: "driver@greenlogistics.com", password: "password123", portalRole: "DRIVER" },
  });
  const driverToken = driverRes.data?.token;
  const driverUserId = driverRes.data?.user?.id;

  const factoryRes = await request("/auth/login", {
    method: "POST",
    body: { email: "factory@apexrecycling.com", password: "password123", portalRole: "FACTORY" },
  });
  const factoryToken = factoryRes.data?.token;

  const customerRes = await request("/auth/login", {
    method: "POST",
    body: { email: "customer@ecotrace.org", password: "password123", portalRole: "CUSTOMER" },
  });
  const customerToken = customerRes.data?.token;

  record(
    1,
    "Authenticate Role Personas (Dealer, Driver, Factory, Customer)",
    Boolean(dealerToken && driverToken && factoryToken && customerToken),
    `Received JWTs for Dealer (${dealerRes.status}), Driver (${driverRes.status}), Factory (${factoryRes.status}), Customer (${customerRes.status})`
  );

  // Ensure driver is set to AVAILABLE
  await DriverModel.updateMany(
    { $or: [{ userId: driverUserId }, { fullName: /Rajesh/i }] },
    { availability: "AVAILABLE" }
  );

  // 2. Fetch destination factory to obtain stored coordinates
  const facListRes = await request("/batches/facilities", { token: dealerToken });
  const facilities = facListRes.data?.facilities || [];
  const apexFac = facilities.find((f: any) => f.code === "FAC-APEX-01") || facilities.find((f: any) => f.location?.latitude);

  record(
    2,
    "Verify Factory Coordinates & Geofence Radius Stored in MongoDB",
    Boolean(apexFac && apexFac.location?.latitude && apexFac.location?.longitude && apexFac.geofenceRadiusMeters),
    `Facility ${apexFac?.name || "Apex"} has coordinates [${apexFac?.location?.latitude}, ${apexFac?.location?.longitude}] with geofence radius ${apexFac?.geofenceRadiusMeters}m`
  );

  // 3. Dealer creates a batch and dispatches it to Driver
  const catRes = await request("/batches/categories");
  const categoryId = catRes.data?.categories?.[0]?.id;

  const batchRes = await request("/batches", {
    method: "POST",
    token: dealerToken,
    body: {
      categoryId,
      destinationFacilityId: apexFac.id || apexFac._id,
      pickupLocation: "Electronic City Depot 4, Bengaluru",
      pickupAddress: "Electronic City Depot 4, Hosur Rd, Bengaluru, KA 560100",
      contactPhone: "+91 98450 12345",
      contactEmail: "collector@ecotrace.network",
      sourceType: "Enterprise IT Decommission",
      description: "Telecom switches and printed circuit boards",
      initialWeightKg: 450.5,
    },
  });
  const batchId = batchRes.data?.batch?.id || batchRes.data?.batch?._id;

  const uniqueSuffix = Date.now().toString().slice(-4);
  const createDispRes = await request("/dispatches", {
    method: "POST",
    token: dealerToken,
    body: {
      batchIds: [batchId],
      driverId: driverUserId,
      vehicleRegistration: `KA-04-LIVE-${uniqueSuffix}`,
      pickupAddress: "Electronic City Depot 4, Hosur Rd, Bengaluru, KA 560100",
      destinationFacilityId: apexFac.id || apexFac._id,
    },
  });

  const testDispatch = createDispRes.data?.dispatch;
  const dispatchId = testDispatch?.id;
  const dispatchRef = testDispatch?.dispatchId;

  record(
    3,
    "Dealer Creates Dispatch with Dealer Custody & Delivery OTP Initialized",
    Boolean(createDispRes.ok && dispatchId && testDispatch.dealerId),
    `Created Dispatch #${dispatchRef} (ID: ${dispatchId}) with dealerId: ${testDispatch?.dealerId}`
  );

  // 4. Role Authorization: Unauthorized user cannot post GPS coordinates
  const unauthLocRes = await request(`/dispatches/${dispatchId}/location`, {
    method: "POST",
    token: customerToken,
    body: {
      latitude: 12.8450,
      longitude: 77.6750,
      heading: 45,
      speed: 35,
      accuracy: 10,
    },
  });

  record(
    4,
    "Role Authorization: Unauthorized User (Customer) Forbidden from Sending Truck GPS",
    unauthLocRes.status === 403,
    `Customer request rejected with HTTP ${unauthLocRes.status} (Forbidden)`
  );

  // 5. Driver advances status to ACCEPTED then PICKED_UP
  await request(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    token: driverToken,
    body: { status: "ACCEPTED" },
  });

  const pickupRes = await request(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    token: driverToken,
    body: { status: "PICKED_UP", pickupWeightKg: 450.5 },
  });

  record(
    5,
    "Driver Workflow: Accept Assignment & Confirm Custody at Pickup",
    pickupRes.ok && pickupRes.data?.dispatch?.status === "PICKED_UP",
    `Shipment advanced to PICKED_UP (Mass: 450.5 kg)`
  );

  // 6. Driver starts trip: START_TRIP action
  const startTripRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "START_TRIP",
      location: { latitude: 12.8460, longitude: 77.6760 },
    },
  });

  const startedStatus = startTripRes.data?.dispatch?.status || startTripRes.data?.status;
  const tripStartedAt = startTripRes.data?.dispatch?.tripStartedAt || startTripRes.data?.tripStartedAt;

  record(
    6,
    "Driver Starts Trip (START_TRIP) and Records Initial Telemetry Fix",
    Boolean(startTripRes.ok && startedStatus === "IN_TRANSIT" && tripStartedAt),
    `Status advanced to IN_TRANSIT, tripStartedAt: ${tripStartedAt}`
  );

  // 7. Live GPS telemetry updates during transit
  const gpsUpdate1 = await request(`/dispatches/${dispatchId}/location`, {
    method: "POST",
    token: driverToken,
    body: {
      latitude: 12.8900,
      longitude: 77.6950,
      speed: 48.5,
      heading: 120,
      accuracy: 15,
      timestamp: new Date().toISOString(),
    },
  });

  record(
    7,
    "Driver Sends Authenticated GPS Coordinates While En Route",
    Boolean(gpsUpdate1.ok && gpsUpdate1.data?.lastKnownLocation?.latitude === 12.8900 && gpsUpdate1.data?.lastKnownLocation?.isStale === false),
    `Transmitted GPS Lat: 12.8900, Lng: 77.6950, Speed: 48.5 km/h, Accuracy: ±15m (Stale: false)`
  );

  // 8. Driver Break Workflow: START_BREAK
  const startBreakRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "START_BREAK",
      reason: "Mandatory Rest Period (Highway Service Area)",
      location: { latitude: 12.9200, longitude: 77.7100 },
    },
  });

  const breakStatus = startBreakRes.data?.dispatch?.status || startBreakRes.data?.status;
  const breakReason = startBreakRes.data?.dispatch?.currentBreak?.reason;

  record(
    8,
    "Driver Initiates Break (START_BREAK) with Timestamp and Location",
    Boolean(startBreakRes.ok && breakStatus === "ON_BREAK" && breakReason),
    `Status transitioned to ON_BREAK with reason: "${breakReason}"`
  );

  // 9. Validation: Cannot resume trip if not on break, or start duplicate break
  const dupBreakRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "START_BREAK",
      reason: "Second break attempt",
    },
  });

  record(
    9,
    "Trip Validation: Reject Duplicate Break Actions While Already On Break",
    dupBreakRes.status === 400,
    `Duplicate break rejected with HTTP ${dupBreakRes.status}: "${dupBreakRes.data?.error}"`
  );

  // 10. Driver Resumes Trip: RESUME_TRIP
  const resumeTripRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "RESUME_TRIP",
      location: { latitude: 12.9210, longitude: 77.7110 },
    },
  });

  const resumedStatus = resumeTripRes.data?.dispatch?.status || resumeTripRes.data?.status;
  const totalBreaks = resumeTripRes.data?.dispatch?.breaks?.length ?? 1;

  record(
    10,
    "Driver Resumes Trip (RESUME_TRIP): Closes Break Event and Restores IN_TRANSIT",
    Boolean(resumeTripRes.ok && resumedStatus === "IN_TRANSIT" && !resumeTripRes.data?.dispatch?.currentBreak),
    `Status restored to IN_TRANSIT, break recorded in manifest history (breaks: ${totalBreaks})`
  );

  // 11. Stale / Offline Location Detection
  // Simulate an old GPS ping from 8 minutes ago directly in Atlas MongoDB
  const eightMinutesAgo = new Date(Date.now() - 8 * 60 * 1000);
  await DispatchModel.updateOne(
    { _id: new mongoose.Types.ObjectId(dispatchId) },
    {
      "lastKnownLocation.updatedAt": eightMinutesAgo,
      staleNotificationSent: false,
    }
  );

  // Dealer polls dispatches
  const dealerDispatchesRes = await request("/dispatches", { token: dealerToken });
  const staleDisp = (dealerDispatchesRes.data?.dispatches || []).find((d: any) => d.id === dispatchId);

  record(
    11,
    "Stale Location Warning: Backend Flags Coordinates Older Than 90 Seconds as isStale=true",
    Boolean(staleDisp && staleDisp.isStale === true && staleDisp.lastKnownLocation?.isStale === true),
    `Dispatch flagged isStale: true (Updated at: ${staleDisp?.lastKnownLocation?.updatedAt})`
  );

  // 12. Geofence Arrival Detection at Factory Perimeter
  // Apex facility is at 12.9850, 77.7400. Send GPS within 100m (e.g. 12.9852, 77.7402)
  const geofenceLocRes = await request(`/dispatches/${dispatchId}/location`, {
    method: "POST",
    token: driverToken,
    body: {
      latitude: 12.9852,
      longitude: 77.7402,
      speed: 10.0,
      heading: 350,
      accuracy: 20, // High accuracy fix
      timestamp: new Date().toISOString(),
    },
  });

  record(
    12,
    "Geofence Detection: Automatic Factory Perimeter Arrival Trigger (500m Gate Radius)",
    Boolean(
      geofenceLocRes.ok &&
      geofenceLocRes.data?.geofenceArrivalDetected === true &&
      geofenceLocRes.data?.status === "ARRIVED_AT_FACTORY"
    ),
    `Status transitioned to ARRIVED_AT_FACTORY, arrivalDetectedNow: ${geofenceLocRes.data?.arrivalDetectedNow}`
  );

  // 13. Obtain generated Delivery Confirmation OTP (from Driver perspective)
  const dispDetailRes = await request(`/dispatches/${dispatchId}/tracking`, { token: driverToken });
  const deliveryOtp = dispDetailRes.data?.deliveryConfirmationOtp;

  record(
    13,
    "Delivery Security: Cryptographic 6-Digit Gate OTP Generated for Manifest",
    Boolean(deliveryOtp && deliveryOtp.length === 6),
    `Generated Delivery OTP Code: ${deliveryOtp}`
  );

  // 14. Delivery Confirmation Role Authorization: Unauthorized user cannot confirm intake
  const unauthConfirm = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: driverToken, // Driver cannot confirm intake for themselves
    body: {
      otp: deliveryOtp,
      receivedWeightKg: 450.5,
    },
  });

  record(
    14,
    "Role Authorization: Driver or Unauthorized User Cannot Self-Confirm Delivery",
    unauthConfirm.status === 403,
    `Driver confirm rejected with HTTP ${unauthConfirm.status} (Forbidden)`
  );

  // 15. Invalid OTP Rejection
  const badOtpConfirm = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: factoryToken,
    body: {
      otp: "000000", // Wrong OTP
      receivedWeightKg: 450.5,
    },
  });

  record(
    15,
    "Security Verification: Invalid OTP Code Rejected by Factory Intake",
    badOtpConfirm.status === 400,
    `Bad OTP rejected with HTTP ${badOtpConfirm.status}: "${badOtpConfirm.data?.error}"`
  );

  // 16. Factory Staff Confirms Delivery with Valid OTP
  const goodConfirm = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: factoryToken,
    body: {
      otp: deliveryOtp,
      verifiedWeightKg: 450.5,
      notes: "All cargo seals intact and verified upon gate arrival.",
    },
  });

  const confirmedDisp = goodConfirm.data?.dispatch;
  record(
    16,
    "Factory Staff Confirms Delivery with Valid OTP & Records Intake Auditor",
    Boolean(goodConfirm.ok && confirmedDisp?.status === "DELIVERED" && confirmedDisp?.deliveryConfirmedAt),
    `Delivery confirmed at: ${confirmedDisp?.deliveryConfirmedAt} by user: ${confirmedDisp?.deliveryConfirmedByUserId}`
  );

  // 17. Duplicate Delivery Confirmation Prevention
  const dupConfirm = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: factoryToken,
    body: {
      otp: deliveryOtp,
      verifiedWeightKg: 450.5,
    },
  });

  record(
    17,
    "Duplicate Intake Prevention: Reject Duplicate Delivery Confirmation Attempts",
    dupConfirm.status === 400,
    `Duplicate confirm blocked with HTTP ${dupConfirm.status}: "${dupConfirm.data?.error}"`
  );

  // 18. Persistent Notifications Verification for Dealer & Factory
  const dealerNotifsRes = await request("/notifications", { token: dealerToken });
  const dealerNotifs = dealerNotifsRes.data?.notifications || [];

  const hasGeofenceNotif = dealerNotifs.some(
    (n: any) => n.title?.includes("Arrived at Factory") || n.message?.includes("geofence")
  );
  const hasDeliveryNotif = dealerNotifs.some(
    (n: any) => n.title?.includes("Delivery Confirmed") || n.message?.includes("confirmed")
  );

  record(
    18,
    "Persistent In-App Notifications: Dealer Receives Geofence Arrival and Delivery Alerts",
    Boolean(hasGeofenceNotif && hasDeliveryNotif),
    `Verified Dealer received persistent alerts: Geofence arrival (${hasGeofenceNotif}), Official delivery confirmation (${hasDeliveryNotif})`
  );

  console.log("\n================================================================================");
  const allPassed = results.every((r) => r.passed);
  console.log(` SUMMARY: ${results.filter((r) => r.passed).length} of ${results.length} Tests Passed`);
  console.log(` FINAL STATUS: ${allPassed ? "🌟 ALL VERIFICATIONS PASSED" : "⚠️ SOME TESTS FAILED"}`);
  console.log("================================================================================\n");

  await mongoose.disconnect();

  if (!allPassed) {
    process.exit(1);
  }
}

runLiveTruckTrackingTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
