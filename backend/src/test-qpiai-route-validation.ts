import { execFile } from "child_process";
import path from "path";
import util from "util";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { qpiAiService } from "./services/qpiai";
import { WasteBatchModel, DriverModel, UserModel, Role, BatchStatus } from "./models";

dotenv.config();

const execFileAsync = util.promisify(execFile);

const projectRoot = path.resolve(__dirname, "../../");
const scriptPath = path.join(projectRoot, "scripts/qpiai_route_optimizer.py");
const venvPython = path.join(projectRoot, ".venv/bin/python3");
const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string, detail?: any) {
  if (condition) {
    console.log(`  [✓ PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [✗ FAIL] ${message}`);
    if (detail !== undefined) {
      console.error(`          Detail:`, detail);
    }
    failedCount++;
  }
}

async function runValidationSuite() {
  console.log("=======================================================================");
  console.log("   ECOTRACE — QPIAI OPT ROUTE VALIDATION & OUTPUT AUDIT SUITE         ");
  console.log("=======================================================================\n");

  const apiKey = qpiAiService.getApiKey() || "";
  assert(apiKey.length === 64, "QPIAI_OPT_API_KEY is present and is a 64-character token");

  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Empty Input Handling (Do Not Fabricate Routes)");
  // -------------------------------------------------------------------------
  {
    // Case 1a: Calling Python bridge with no CLI argument
    const { stdout: emptyStdout } = await execFileAsync(venvPython, [scriptPath], {
      env: { ...process.env, QPIAI_OPT_API_KEY: apiKey },
    });
    const emptyRes = JSON.parse(emptyStdout.trim());
    assert(emptyRes.success === false, "Empty input reports success=false");
    assert(emptyRes.status === "EMPTY_INPUT_NO_BATCHES", "Status is explicitly EMPTY_INPUT_NO_BATCHES");
    assert(emptyRes.solverStatus === "NOT_INVOKED", "Solver status is NOT_INVOKED on empty input");
    assert(Array.isArray(emptyRes.waypoints) && emptyRes.waypoints.length === 0, "Waypoints is empty array (0 waypoints)");
    assert(emptyRes.co2SavingsKg === null, "co2SavingsKg is explicitly null (not undefined, not fabricated)");
    assert(typeof emptyRes.co2SavingsExplanation === "string" && emptyRes.co2SavingsExplanation.includes("empty"), "Explains why CO2 savings cannot be calculated on empty input");

    // Case 1b: Calling Python bridge with explicit empty batches array []
    const { stdout: explicitEmptyStdout } = await execFileAsync(
      venvPython,
      [scriptPath, JSON.stringify({ batches: [], drivers: [], apiKey })],
      { env: { ...process.env, QPIAI_OPT_API_KEY: apiKey } }
    );
    const explicitEmptyRes = JSON.parse(explicitEmptyStdout.trim());
    assert(explicitEmptyRes.success === false, "Explicit batches=[] reports success=false");
    assert(explicitEmptyRes.status === "EMPTY_INPUT_NO_BATCHES", "Explicit batches=[] returns EMPTY_INPUT_NO_BATCHES");
    assert(explicitEmptyRes.waypoints.length === 0, "Zero waypoints generated for empty batches list");
    assert(explicitEmptyRes.co2SavingsKg === null, "co2SavingsKg is null for empty batches list");
  }

  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] Valid Input Optimization & Documented CO2 Emissions");
  // -------------------------------------------------------------------------
  {
    const validPayload = JSON.stringify({
      batches: [
        { batchId: "B-VAL-1", name: "Peenya Aggregator Hub", weightKg: 400, latitude: 13.03, longitude: 77.51 },
        { batchId: "B-VAL-2", name: "Koramangala Depot", weightKg: 550, latitude: 12.93, longitude: 77.62 },
      ],
      drivers: [
        { id: "D-VAL-1", driverId: "DRV-V1", fullName: "Kiran Rao", capacityKg: 3500, availability: "AVAILABLE" },
      ],
      destination: { name: "Apex E-Waste Hub", latitude: 12.8399, longitude: 77.677 },
      apiKey,
    });

    const { stdout } = await execFileAsync(venvPython, [scriptPath, validPayload], {
      env: { ...process.env, QPIAI_OPT_API_KEY: apiKey },
    });
    const res = JSON.parse(stdout.trim());

    assert(res.success === true, "Valid input solves with success=true");
    assert(res.status === "QPIAI_OPTIMIZATION_SUCCEEDED", "Status is QPIAI_OPTIMIZATION_SUCCEEDED");
    assert(res.engine === "QpiAI_Opt_HiGHS_MILP", "Truthfully reports engine as QpiAI_Opt_HiGHS_MILP (not false Quantum)");
    assert(res.solverName === "HiGHS", "Identifies actual solver as classical HiGHS");
    assert(res.hardwareBackend === "Classical CPU (Local execution)", "Identifies hardware backend truthfully as Classical CPU");
    assert(res.executionMode === "local", "Execution mode is local");
    assert(res.solverStatus === "optimal", "Solver status is optimal");
    assert(Array.isArray(res.waypoints) && res.waypoints.length === 3, "Returns 3 sequential waypoints (2 pickups + 1 factory destination)");
    assert(res.waypoints[res.waypoints.length - 1].weightKg === 0, "Final waypoint is the factory destination");
    assert(typeof res.co2SavingsKg === "number" && res.co2SavingsKg > 0, `CO2 savings is a genuine positive number (${res.co2SavingsKg} kg CO2e)`);
    assert(res.co2SavingsExplanation.includes("0.243 kg CO2e/km"), "CO2 savings calculation cites documented DEFRA commercial diesel factor (0.243 kg/km)");
  }

  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] Solver Failure / Vehicle Capacity Infeasibility");
  // -------------------------------------------------------------------------
  {
    // Driver capacity is 500 kg, but batch weight is 15,000 kg
    const infeasiblePayload = JSON.stringify({
      batches: [{ batchId: "OVERSIZED-99", weightKg: 15000, latitude: 13.0, longitude: 77.6 }],
      drivers: [{ id: "D-TINY", capacityKg: 500, availability: "AVAILABLE" }],
      apiKey,
    });

    const { stdout } = await execFileAsync(venvPython, [scriptPath, infeasiblePayload], {
      env: { ...process.env, QPIAI_OPT_API_KEY: apiKey },
    });
    const res = JSON.parse(stdout.trim());

    assert(res.driverAssignments.length === 0, "No driver is assigned an oversized payload exceeding capacity");
    assert(res.unassignedBatches.length === 1, "Oversized batch is recorded as unassigned");
    assert(res.unassignedBatches[0].reason.includes("capacity"), "Unassigned reason explains capacity constraint violation");
    assert(res.waypoints.length === 0, "Zero waypoints generated when no feasible driver assignments exist");
    assert(res.co2SavingsKg === null, "co2SavingsKg is null when no batches are assigned");
  }

  // -------------------------------------------------------------------------
  console.log("\n[TEST 4] Malformed Output & Parse Error Handling");
  // -------------------------------------------------------------------------
  {
    const { stdout } = await execFileAsync(venvPython, [scriptPath, "{bad_json: not_quoted}"], {
      env: { ...process.env, QPIAI_OPT_API_KEY: apiKey },
    });
    const res = JSON.parse(stdout.trim());
    assert(res.success === false, "Malformed payload reports success=false");
    assert(res.status === "MALFORMED_INPUT_PAYLOAD", "Returns MALFORMED_INPUT_PAYLOAD status cleanly");
    assert(res.solverStatus === "NOT_INVOKED", "Solver is NOT_INVOKED on malformed payload");
    assert(res.waypoints.length === 0, "Zero waypoints on malformed payload");
    assert(res.co2SavingsKg === null, "co2SavingsKg is null on malformed payload");
  }

  // -------------------------------------------------------------------------
  console.log("\n[TEST 5] Unavailable Credentials Handling");
  // -------------------------------------------------------------------------
  {
    const { stdout } = await execFileAsync(
      venvPython,
      [scriptPath, JSON.stringify({ batches: [{ batchId: "B1", weightKg: 100 }], drivers: [], apiKey: "" })],
      { env: { ...process.env, QPIAI_OPT_API_KEY: "" } }
    );
    const res = JSON.parse(stdout.trim());
    assert(res.success === false, "Missing API key reports success=false");
    assert(res.status === "QPIAI_OPT_CONFIG_MISSING", "Status is QPIAI_OPT_CONFIG_MISSING");
    assert(res.apiAuthStatus?.configured === false, "apiAuthStatus.configured is false");
    assert(res.waypoints.length === 0, "Zero waypoints when credentials missing");
    assert(res.co2SavingsKg === null, "co2SavingsKg is null when credentials missing");
  }

  // -------------------------------------------------------------------------
  console.log("\n[TEST 6] Authentication vs Optimization Distinction");
  // -------------------------------------------------------------------------
  {
    // Provide a valid API key, but empty batch input
    const { stdout } = await execFileAsync(
      venvPython,
      [scriptPath, JSON.stringify({ batches: [], drivers: [{ id: "D1", availability: "AVAILABLE" }], apiKey })],
      { env: { ...process.env, QPIAI_OPT_API_KEY: apiKey } }
    );
    const res = JSON.parse(stdout.trim());
    assert(
      res.apiAuthStatus?.serverAuthenticated === true,
      "Step A: Server authentication is SUCCESSFUL with live QpiAI Opt cloud"
    );
    assert(
      res.solverStatus === "NOT_INVOKED",
      "Step B: Solver was NOT INVOKED because input is empty"
    );
    assert(
      res.status === "EMPTY_INPUT_NO_BATCHES",
      "Step C: Optimization status is EMPTY_INPUT_NO_BATCHES (distinguished from successful optimization)"
    );
    assert(
      res.waypoints.length === 0,
      "Step D: Route waypoints result is EMPTY (zero waypoints)"
    );
    assert(
      res.co2SavingsKg === null,
      "Step E: CO2 savings is NULL (not undefined and not fabricated)"
    );
  }

  // -------------------------------------------------------------------------
  console.log("\n[TEST 7] Backend Express API Route (GET /api/dispatches/optimize-routes)");
  // -------------------------------------------------------------------------
  {
    // Login as driver to obtain JWT
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "driver@greenlogistics.com", password: "password123", portalRole: "DRIVER" }),
    });
    const loginData = (await loginRes.json()) as any;
    assert(!!loginData.token, "Authenticated login succeeds with valid JWT");

    const routeRes = await fetch(`${BASE_URL}/api/dispatches/optimize-routes`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert(routeRes.status === 200, "GET /api/dispatches/optimize-routes returns HTTP 200");

    const routeData = (await routeRes.json()) as any;
    const opt = routeData.optimization;
    assert(typeof opt === "object" && opt !== null, "Optimization object is present in response");
    assert(opt.engine === "QpiAI_Opt_HiGHS_MILP", `Engine is truthfully reported as QpiAI_Opt_HiGHS_MILP (actual: ${opt.engine})`);
    assert(opt.solverName === "HiGHS", `Solver is identified as HiGHS (actual: ${opt.solverName})`);
    assert(opt.hardwareBackend === "Classical CPU (Local execution)", "Hardware backend is Classical CPU (Local execution)");
    assert(opt.co2SavingsKg !== undefined, "co2SavingsKg is NOT undefined");
    assert(opt.carbonSavingsKg !== undefined, "carbonSavingsKg is NOT undefined");
    assert(Array.isArray(opt.orderedWaypoints), "orderedWaypoints is a valid array");
    assert(Array.isArray(opt.waypoints), "waypoints is a valid array");
    assert(opt.qpiaiLiveValidation?.serverAuthenticated === true, "qpiaiLiveValidation reports serverAuthenticated=true");
  }

  console.log("\n=======================================================================");
  console.log(`   VALIDATION SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED   `);
  console.log("=======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runValidationSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
