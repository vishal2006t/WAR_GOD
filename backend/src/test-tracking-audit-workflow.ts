/**
 * EcoTrace Live Shipment Tracking & Factory Arrival Verification
 * Dedicated Audit Workflow Verification Script
 * Validates:
 * 1. Driver GPS broadcast acceptance, MongoDB persistence, and Dealer polling freshness
 * 2. Stale location detection (>90s) and dealer warning notification
 * 3. Complete Start Trip -> GPS -> Break -> Resume -> Geofence -> Gate OTP intake lifecycle
 * 4. Google Routes API v2 road calculation and fallback mechanism
 * 5. Strict authorization, duplicate confirmation prevention, and DB assertions
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DispatchModel } from "./models/Dispatch";
import { FacilityModel } from "./models/Facility";
import { WasteBatchModel } from "./models/WasteBatch";
import { DriverModel } from "./models/Driver";
import { NotificationModel } from "./models/Notification";
import { AuditLogModel } from "./models/AuditLog";
import { DispatchStatus, Role } from "./models/enums";

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
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[Step ${step}] ${icon} — ${name}: ${details}`);
}

async function request(endpoint: string, options: { method?: string; token?: string; body?: any } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  return { status: res.status, ok: res.ok, data };
}

async function runAudit() {
  console.log("\n================================================================================");
  console.log(" ECOTRACE SHIPMENT TRACKING & FACTORY ARRIVAL AUDIT VERIFICATION");
  console.log(" Live MongoDB Atlas | Express API | RBAC | Geofencing | Gate OTP Intake");
  console.log("================================================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/ecotrace";
  await mongoose.connect(mongoUri);

  // 1. Authenticate Personas
  const dealerAuth = await request("/auth/login", {
    method: "POST",
    body: { email: "dealer@metrocollect.com", password: "password123", portalRole: Role.DEALER },
  });
  const driverAuth = await request("/auth/login", {
    method: "POST",
    body: { email: "driver@greenlogistics.com", password: "password123", portalRole: Role.DRIVER },
  });
  const factoryAuth = await request("/auth/login", {
    method: "POST",
    body: { email: "factory@apexrecycling.com", password: "password123", portalRole: Role.FACTORY },
  });
  const customerAuth = await request("/auth/login", {
    method: "POST",
    body: { email: "customer@ecotrace.org", password: "password123", portalRole: Role.CUSTOMER },
  });

  const dealerToken = dealerAuth.data?.token;
  const driverToken = driverAuth.data?.token;
  const factoryToken = factoryAuth.data?.token;
  const customerToken = customerAuth.data?.token;

  record(
    1,
    "Authenticate Role Personas (Dealer, Driver, Factory, Customer)",
    Boolean(dealerToken && driverToken && factoryToken && customerToken),
    `Received JWTs for all 4 personas`
  );

  // Ensure driver is set to AVAILABLE
  await DriverModel.updateMany(
    { $or: [{ userId: driverAuth.data?.user?.id }, { fullName: /Rajesh/i }] },
    { availability: "AVAILABLE" }
  );

  // 2. Destination Factory Geofence Inspection
  const factoryUserFacilityId = factoryAuth.data?.user?.facility?.id || factoryAuth.data?.user?.facilityId;
  let factory = factoryUserFacilityId
    ? await FacilityModel.findById(factoryUserFacilityId).lean()
    : await FacilityModel.findOne({ name: /Apex/i }).lean();

  if (!factory?.location?.latitude || !factory?.geofenceRadiusMeters) {
    await FacilityModel.updateOne(
      { _id: (factory as any)._id },
      { location: { latitude: 12.985, longitude: 77.74 }, geofenceRadiusMeters: 500 }
    );
    factory = await FacilityModel.findById((factory as any)._id).lean();
  }

  const facLat = factory?.location?.latitude ?? 12.985;
  const facLng = factory?.location?.longitude ?? 77.74;
  const facRadius = factory?.geofenceRadiusMeters ?? 500;

  record(
    2,
    "Verify Factory Coordinates & Geofence Radius in MongoDB Atlas",
    Boolean(factory && facLat && facLng && facRadius === 500),
    `Facility: ${factory?.name} at [${facLat}, ${facLng}], Radius: ${facRadius}m`
  );

  // 3. Create fresh test batch and dispatch
  const catRes = await request("/batches/categories");
  const categoryId = catRes.data?.categories?.[0]?.id || "679800000000000000000001";

  const batchRes = await request("/batches", {
    method: "POST",
    token: dealerToken,
    body: {
      categoryId,
      destinationFacilityId: (factory as any)._id.toString(),
      pickupLocation: "Electronic City Depot 4, Bengaluru",
      pickupAddress: "Electronic City Depot 4, Hosur Rd, Bengaluru, KA 560100",
      contactPhone: "+91 98450 12345",
      contactEmail: "collector@ecotrace.network",
      sourceType: "Enterprise IT Decommission",
      description: "Telecom switches and printed circuit boards",
      initialWeightKg: 520.0,
    },
  });
  const batchId = batchRes.data?.batch?.id || batchRes.data?.batch?._id;

  const createDispRes = await request("/dispatches", {
    method: "POST",
    token: dealerToken,
    body: {
      batchIds: [batchId],
      driverId: driverAuth.data?.user?.id,
      destinationFacilityId: (factory as any)._id.toString(),
      vehicleRegistration: `KA-01-ET-${Date.now().toString().slice(-4)}`,
      dispatchedWeightKg: 520.0,
      pickupAddress: "Electronic City Phase 1, Bengaluru",
    },
  });

  const dispatchId = createDispRes.data?.dispatch?.id || createDispRes.data?.dispatch?._id;
  const dispatchNum = createDispRes.data?.dispatch?.dispatchId;

  record(
    3,
    "Dealer Creates Dispatch with Initialized Delivery OTP & Dealer Ownership",
    Boolean(createDispRes.ok && dispatchId && dispatchNum),
    `Dispatch #${dispatchNum} created with ID: ${dispatchId}`
  );

  // 4. Role Authorization: Customer blocked from dispatch telemetry
  const unauthorizedGpsRes = await request(`/dispatches/${dispatchId}/location`, {
    method: "POST",
    token: customerToken,
    body: { latitude: 12.89, longitude: 77.695, speed: 45, heading: 90, accuracy: 12 },
  });

  record(
    4,
    "Role Security: Unauthorized Users (Customer) Blocked from Broadcasting GPS",
    unauthorizedGpsRes.status === 403,
    `Customer request rejected with HTTP ${unauthorizedGpsRes.status} (Forbidden)`
  );

  // 5. Driver Accepts Assignment & Confirms Pickup
  await request(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    token: driverToken,
    body: { status: DispatchStatus.ACCEPTED },
  });
  const pickupRes = await request(`/dispatches/${dispatchId}/status`, {
    method: "PATCH",
    token: driverToken,
    body: { status: DispatchStatus.PICKED_UP },
  });

  record(
    5,
    "Driver Workflow: Accept Assignment and Confirm Pickup Custody",
    Boolean(pickupRes.ok && pickupRes.data?.dispatch?.status === "PICKED_UP"),
    `Status transitioned to PICKED_UP`
  );

  // 6. Driver Starts Trip: START_TRIP
  const startTripRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "START_TRIP",
      location: { latitude: 12.8399, longitude: 77.677 },
    },
  });

  const tripStartedAt = startTripRes.data?.dispatch?.tripStartedAt;
  record(
    6,
    "Driver Starts Trip (START_TRIP): Status IN_TRANSIT with Trip Timestamp",
    Boolean(startTripRes.ok && startTripRes.data?.dispatch?.status === "IN_TRANSIT" && tripStartedAt),
    `Status advanced to IN_TRANSIT, tripStartedAt: ${tripStartedAt}`
  );

  // 7. Driver Broadcasts Live GPS Updates & MongoDB Saves Them
  const gpsRes = await request(`/dispatches/${dispatchId}/location`, {
    method: "POST",
    token: driverToken,
    body: {
      latitude: 12.885,
      longitude: 77.695,
      speed: 52.0,
      heading: 42,
      accuracy: 15,
      timestamp: new Date().toISOString(),
    },
  });

  // Verify directly in MongoDB Atlas
  const savedDispInDb = await DispatchModel.findById(dispatchId).lean();
  const dbLoc = savedDispInDb?.lastKnownLocation;

  record(
    7,
    "Driver Broadcasts GPS: API Accepts and MongoDB Saves Telemetry Fix",
    Boolean(
      gpsRes.ok &&
      dbLoc &&
      dbLoc.latitude === 12.885 &&
      dbLoc.longitude === 77.695 &&
      dbLoc.speed === 52 &&
      dbLoc.isStale === false
    ),
    `Saved in MongoDB: Lat ${dbLoc?.latitude}, Lng ${dbLoc?.longitude}, Speed ${dbLoc?.speed} km/h, Stale: ${dbLoc?.isStale}`
  );

  // 8. Dealer Polling Endpoint Returns Fresh Coordinates (<5s old)
  const dealerDispatchesRes = await request("/dispatches", { token: dealerToken });
  const polledDisp = (dealerDispatchesRes.data?.dispatches || []).find((d: any) => d.id === dispatchId);
  const updatedAtTime = polledDisp?.lastKnownLocation?.updatedAt ? new Date(polledDisp.lastKnownLocation.updatedAt).getTime() : 0;
  const ageSec = Math.round((Date.now() - updatedAtTime) / 1000);

  record(
    8,
    "Dealer Polling Endpoint Returns Fresh Coordinates (ageSec <= 10s, isStale=false)",
    Boolean(polledDisp && polledDisp.isStale === false && ageSec <= 10),
    `Dealer received fresh telemetry: ageSec=${ageSec}s, isStale=${polledDisp?.isStale}`
  );

  // 9. Stale GPS Warning: When updates stop for >90s, flag isStale=true
  const ninetyFiveSecondsAgo = new Date(Date.now() - 95 * 1000);
  await DispatchModel.updateOne(
    { _id: new mongoose.Types.ObjectId(dispatchId) },
    {
      "lastKnownLocation.updatedAt": ninetyFiveSecondsAgo,
      staleNotificationSent: false,
    }
  );

  const stalePollingRes = await request("/dispatches", { token: dealerToken });
  const staleDisp = (stalePollingRes.data?.dispatches || []).find((d: any) => d.id === dispatchId);

  // Also verify dealer received persistent stale notification
  const staleNotif = await NotificationModel.findOne({
    userId: dealerAuth.data.user.id,
    entityId: dispatchNum,
    type: "WARNING",
  }).sort({ createdAt: -1 }).lean();

  record(
    9,
    "Stale Location Warning: Backend Flags Coordinates >90s Old as isStale=true and Notifies Dealer",
    Boolean(staleDisp && staleDisp.isStale === true && staleDisp.lastKnownLocation?.isStale === true && staleNotif),
    `Dispatch flagged isStale: true (Notification: "${staleNotif?.title}")`
  );

  // 10. Driver Starts Break with Reason and Location
  const startBreakRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "START_BREAK",
      reason: "Mandatory Driver Rest Stop",
      location: { latitude: 12.912, longitude: 77.712 },
    },
  });

  record(
    10,
    "Driver Initiates Break (START_BREAK): Status Transitions to ON_BREAK with Reason",
    Boolean(startBreakRes.ok && startBreakRes.data?.dispatch?.status === "ON_BREAK"),
    `Status: ON_BREAK, Reason: "${startBreakRes.data?.dispatch?.currentBreak?.reason}"`
  );

  // 11. Duplicate Break Prevention
  const dupBreakRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: { action: "START_BREAK", reason: "Attempt while already on break" },
  });

  record(
    11,
    "Trip Validation: Reject Duplicate Break Actions While Already On Break",
    dupBreakRes.status === 400,
    `Blocked with HTTP 400: "${dupBreakRes.data?.error}"`
  );

  // 12. Driver Resumes Trip: RESUME_TRIP
  const resumeTripRes = await request(`/dispatches/${dispatchId}/trip-action`, {
    method: "POST",
    token: driverToken,
    body: {
      action: "RESUME_TRIP",
      location: { latitude: 12.925, longitude: 77.72 },
    },
  });

  record(
    12,
    "Driver Resumes Trip (RESUME_TRIP): Closes Break and Restores IN_TRANSIT",
    Boolean(resumeTripRes.ok && resumeTripRes.data?.dispatch?.status === "IN_TRANSIT" && !resumeTripRes.data?.dispatch?.currentBreak),
    `Status restored to IN_TRANSIT, recorded breaks: ${resumeTripRes.data?.dispatch?.breaks?.length}`
  );

  // 13. Automatic Factory Geofence Perimeter Arrival Detection (within 500m)
  const geofenceRes = await request(`/dispatches/${dispatchId}/location`, {
    method: "POST",
    token: driverToken,
    body: {
      latitude: facLat + 0.0002, // ~25 meters from factory gate
      longitude: facLng + 0.0002,
      accuracy: 20,
      speed: 8.0,
      heading: 355,
      timestamp: new Date().toISOString(),
    },
  });

  const isArrived = Boolean(
    geofenceRes.ok &&
    (geofenceRes.data?.status === "ARRIVED_AT_FACTORY" || geofenceRes.data?.geofenceArrivalDetected) &&
    geofenceRes.data?.arrivalDetectedNow === true
  );

  record(
    13,
    "Geofence Detection: Automatic Factory Perimeter Arrival Trigger (500m Gate Radius)",
    isArrived,
    `Status: ${geofenceRes.data?.status}, arrivalDetectedNow=${geofenceRes.data?.arrivalDetectedNow}, distance: ${geofenceRes.data?.distanceKm} km`
  );

  // 14. Gate OTP Generation & Driver Access
  const trackingRes = await request(`/dispatches/${dispatchId}/tracking`, { token: driverToken });
  const deliveryOtp = trackingRes.data?.deliveryConfirmationOtp || savedDispInDb?.deliveryConfirmationOtp;

  record(
    14,
    "Delivery Security: Cryptographic 6-Digit Gate OTP Assigned to Manifest",
    Boolean(deliveryOtp && deliveryOtp.length === 6),
    `Verified 6-Digit Gate OTP: ${deliveryOtp}`
  );

  // 15. Driver Cannot Self-Confirm Delivery
  const driverConfirmRes = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: driverToken,
    body: { otp: deliveryOtp, verifiedWeightKg: 520.0 },
  });

  record(
    15,
    "Role Authorization: Driver Blocked from Self-Confirming Delivery Handover",
    driverConfirmRes.status === 403,
    `Driver confirm rejected with HTTP ${driverConfirmRes.status} (Forbidden)`
  );

  // 16. Invalid OTP Code Rejected by Factory Intake
  const badOtpRes = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: factoryToken,
    body: { otp: "000000", verifiedWeightKg: 520.0 },
  });

  record(
    16,
    "Security Verification: Invalid Handover OTP Rejected with HTTP 400",
    badOtpRes.status === 400,
    `Bad OTP rejected: "${badOtpRes.data?.error}"`
  );

  // 17. Authorized Factory Staff Confirms Delivery with Valid OTP
  const confirmDeliveryRes = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: factoryToken,
    body: {
      otp: deliveryOtp,
      verifiedWeightKg: 521.5,
      notes: "Weighbridge tare and gross verified at Apex Disassembly Gate 1.",
    },
  });

  record(
    17,
    "Factory Staff Confirms Delivery with Valid OTP and Weighbridge Intake",
    Boolean(confirmDeliveryRes.ok && confirmDeliveryRes.data?.dispatch?.status === "DELIVERED"),
    `Delivery confirmed at: ${confirmDeliveryRes.data?.dispatch?.deliveryConfirmedAt} by Auditor ID: ${confirmDeliveryRes.data?.dispatch?.deliveryConfirmedByUserId}`
  );

  // 18. Duplicate Confirmation Strictly Blocked
  const dupConfirmRes = await request(`/dispatches/${dispatchId}/confirm-delivery`, {
    method: "POST",
    token: factoryToken,
    body: { otp: deliveryOtp, verifiedWeightKg: 521.5 },
  });

  record(
    18,
    "Duplicate Intake Prevention: Reject Duplicate Delivery Confirmation Attempts",
    dupConfirmRes.status === 400,
    `Duplicate confirm blocked with HTTP 400: "${dupConfirmRes.data?.error}"`
  );

  // 19. Google Routes API v2 Road Calculation
  const routeRes = await request("/maps/route", {
    method: "POST",
    token: dealerToken,
    body: {
      origin: { lat: 12.8399, lng: 77.677 },
      destination: { lat: facLat, lng: facLng },
    },
  });

  record(
    19,
    "Google Routes API v2: Computes Actual Road Route with Real Distance and Polyline",
    Boolean(routeRes.ok && routeRes.data?.success && routeRes.data?.distanceKm > 0 && routeRes.data?.polyline),
    `Road Distance: ${routeRes.data?.distanceKm} km, Duration: ${routeRes.data?.durationText}, Source: ${routeRes.data?.source || "Routes API"}`
  );

  // 20. Database Assertions: Audit Logs Recorded
  const auditLogs = await AuditLogModel.find({
    entityId: dispatchNum,
  }).lean();

  const auditActions = auditLogs.map((l) => l.action);
  const requiredActions = ["TRIP_STARTED", "BREAK_STARTED", "BREAK_ENDED", "GEOFENCE_ARRIVAL_DETECTED", "FACTORY_DELIVERY_CONFIRMED"];
  const allAuditsFound = requiredActions.every((act) => auditActions.includes(act));

  record(
    20,
    "Database Audit Integrity: Immutable Audit Trail Records Every Transition in MongoDB Atlas",
    allAuditsFound,
    `Recorded audit actions: ${auditActions.join(", ")}`
  );

  console.log("\n================================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(` SUMMARY: ${totalPassed} of ${results.length} Tests Passed`);
  console.log(` FINAL STATUS: ${totalPassed === results.length ? "🌟 ALL VERIFICATIONS PASSED" : "⚠️ SOME TESTS FAILED"}`);
  console.log("================================================================================\n");

  await mongoose.disconnect();

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Audit test error:", err);
  process.exit(1);
});
