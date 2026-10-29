// EcoTrace — Google Maps & Routes API v2 Verification Suite
// Tests modern Routes API computeRoutes, authorization, in-memory caching, and fallback handling

import dotenv from "dotenv";
dotenv.config();

import { googleMapsService } from "./services/googleMaps";

const BASE_URL = "http://localhost:5000";

interface TestResult {
  step: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: number, description: string, passed: boolean, details: string) {
  results.push({ step, description, passed, details });
  const icon = passed ? "[✓ PASS]" : "[✗ FAIL]";
  console.log(`\n${icon} Check #${step}: ${description}`);
  console.log(`       ${details}`);
}

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  const res = await (globalThis.fetch || fetch)(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Ignore non-json
  }
  return { status: res.status, ok: res.ok, data };
}

async function runGoogleMapsSuite() {
  console.log("================================================================================");
  console.log(" ECOTRACE — GOOGLE MAPS & ROUTES API V2 VERIFICATION SUITE");
  console.log(" Modern Compute Routes • Field Masks • Live Traffic • Secure Zero-Leakage");
  console.log("================================================================================");

  // 1. GET /api/maps/config
  const configRes = await request("/api/maps/config");
  const isGoogleConfigured =
    configRes.ok &&
    configRes.data?.routingEngine === "GOOGLE_ROUTES_API" &&
    configRes.data?.serverRoutesApiConfigured === true;
  record(
    1,
    "GET /api/maps/config reports GOOGLE_ROUTES_API with serverRoutesApiConfigured=true",
    isGoogleConfigured,
    `Routing Engine: "${configRes.data?.routingEngine}"; Provider: "${configRes.data?.provider}"`
  );

  // 2. Direct Routes API v2 computeRoutes execution
  const origin = { lat: 12.9716, lng: 77.5946 }; // Bengaluru
  const destination = { lat: 12.8488, lng: 77.6482 }; // Electronic City
  const routeResult = await googleMapsService.computeRoadRoute(origin, destination);

  const routeOk =
    routeResult.success === true &&
    routeResult.isRoadRoute === true &&
    typeof routeResult.distanceKm === "number" &&
    routeResult.distanceKm > 15 &&
    typeof routeResult.durationMinutes === "number" &&
    routeResult.durationMinutes > 20 &&
    typeof routeResult.polyline === "string" &&
    routeResult.polyline.length > 100;

  record(
    2,
    "Google Routes API v2 computes actual road route, distance, live duration, and polyline",
    routeOk,
    `Distance: ${routeResult.distanceKm} km; Duration: ${routeResult.durationText}; Polyline length: ${routeResult.polyline?.length} chars; Source: ${routeResult.source}`
  );

  // 3. Fast In-Memory Cache
  const t0 = Date.now();
  const cachedResult = await googleMapsService.computeRoadRoute(origin, destination);
  const t1 = Date.now();
  const cacheOk = cachedResult.source === "CACHED" && t1 - t0 < 50;
  record(
    3,
    "Repeat route calculations hit in-memory cache (< 50ms) to conserve API quota",
    cacheOk,
    `Source: "${cachedResult.source}"; Response time: ${t1 - t0} ms`
  );

  // 4. Text address routing via Routes API
  const addrDest = { address: "Electronic City, Bengaluru, Karnataka, India" };
  const addrResult = await googleMapsService.computeRoadRoute(origin, addrDest);
  const addrOk = addrResult.success === true && addrResult.isRoadRoute === true && (addrResult.distanceKm || 0) > 10;
  record(
    4,
    "Google Routes API resolves text address destinations directly to road routes",
    addrOk,
    `Destination: "${addrDest.address}"; Distance: ${addrResult.distanceKm} km; Duration: ${addrResult.durationText}`
  );

  // 5. Unauthenticated requests to /api/maps/route rejected
  const unauthRes = await request("/api/maps/route", {
    method: "POST",
    body: { origin, destination },
  });
  record(
    5,
    "POST /api/maps/route rejects unauthenticated requests with HTTP 401",
    unauthRes.status === 401,
    `Received HTTP status ${unauthRes.status}`
  );

  // 6. Authorized requests to /api/maps/route succeed
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: { email: "driver@greenlogistics.com", password: "password123", portalRole: "DRIVER" },
  });
  const driverToken = loginRes.data?.token;

  const authRouteRes = await request("/api/maps/route", {
    method: "POST",
    token: driverToken,
    body: { origin, destination },
  });
  const authOk = authRouteRes.ok && authRouteRes.data?.success === true && authRouteRes.data?.isRoadRoute === true;
  record(
    6,
    "POST /api/maps/route returns road route and live traffic ETA for authenticated users",
    authOk,
    `HTTP ${authRouteRes.status}; Distance: ${authRouteRes.data?.distanceKm} km; Duration: ${authRouteRes.data?.durationText}; Source: ${authRouteRes.data?.source}`
  );

  // 7. GET /api/maps/pickup-route/:taskId
  const tasksRes = await request("/api/drivers/tasks", { token: driverToken });
  const tasks = tasksRes.data?.tasks || [];
  let taskCheckPassed = false;
  let taskDetails = "No active tasks found for driver";

  if (tasks.length > 0) {
    const taskId = tasks[0].taskId;
    const taskRouteRes = await request(`/api/maps/pickup-route/${taskId}`, { token: driverToken });
    if (taskRouteRes.ok && taskRouteRes.data?.success) {
      taskCheckPassed = true;
      taskDetails = `Task: ${taskId}; Distance: ${taskRouteRes.data.distanceKm} km; ETA: ${taskRouteRes.data.durationMinutes} mins; Source: ${taskRouteRes.data.source}`;
    } else {
      taskDetails = `Task: ${taskId}; Response: ${JSON.stringify(taskRouteRes.data)}`;
    }
  } else {
    // If no tasks assigned, check 404 for invalid ID
    const dummyRouteRes = await request("/api/maps/pickup-route/PKT-SAMPLE-0001", { token: driverToken });
    taskCheckPassed = dummyRouteRes.status === 404;
    taskDetails = `Non-existent task correctly returned HTTP ${dummyRouteRes.status} (Not Found)`;
  }

  record(
    7,
    "GET /api/maps/pickup-route/:taskId connects driver GPS to customer pickup destination",
    taskCheckPassed,
    taskDetails
  );

  // 8. Fallback on invalid destination coordinates
  const invalidDest = { lat: 0, lng: 0 };
  const fallbackResult = await googleMapsService.computeRoadRoute(origin, invalidDest);
  const fallbackOk = fallbackResult.isRoadRoute === false || fallbackResult.success === false;
  record(
    8,
    "Invalid/unreachable locations report clear notice without faking road routes",
    fallbackOk,
    `isRoadRoute: ${fallbackResult.isRoadRoute}; Notice: "${fallbackResult.notice || fallbackResult.error || 'Direct fallback handled'}"`
  );

  console.log("\n================================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(` SUITE SUMMARY: ${passedCount} / ${results.length} CHECKS PASSED (${Math.round((passedCount / results.length) * 100)}%)`);
  console.log("================================================================================\n");
}

runGoogleMapsSuite().catch(console.error);
