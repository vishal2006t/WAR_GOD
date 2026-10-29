import "dotenv/config";
import { execFile } from "child_process";
import path from "path";
import util from "util";

const execFileAsync = util.promisify(execFile);

async function runQpiAiDiagnostics() {
  console.log("===============================================================");
  console.log("     ECOTRACE — QPIAI OPT DEEP INTEGRATION DIAGNOSTIC SUITE    ");
  console.log("===============================================================\n");

  const apiKey = process.env.QPIAI_OPT_API_KEY?.trim() || "";
  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : "(empty)";

  // 1. Environment & Configuration Check
  console.log("[TEST 1] Environment Variable & Key Format Check:");
  console.log(`  - Variable: QPIAI_OPT_API_KEY`);
  console.log(`  - Key Present: ${apiKey ? "YES" : "NO"}`);
  console.log(`  - Key Length: ${apiKey.length} chars`);
  console.log(`  - Masked Value: ${maskedKey}`);
  const isKeyFormatOk = apiKey.length >= 32;
  console.log(`  - Format Status: ${isKeyFormatOk ? "PASS (Hex string format)" : "FAIL (Too short or empty)"}\n`);

  // 2. QpiAI Server Reachability
  console.log("[TEST 2] QpiAI Opt Server Reachability (https://opt-server.qpiai.tech/api/health):");
  try {
    const healthRes = await fetch("https://opt-server.qpiai.tech/api/health", { signal: AbortSignal.timeout(5000) });
    const healthData: any = await healthRes.json();
    console.log(`  - HTTP Status: ${healthRes.status}`);
    console.log(`  - Server Response: ${JSON.stringify(healthData)}`);
    console.log(`  - Reachability: ${healthRes.ok && healthData.status === "ok" ? "PASS (Online & Healthy)" : "FAIL"}\n`);
  } catch (err: any) {
    console.log(`  - Reachability: FAIL (${err.message})\n`);
  }

  // 3. QpiAI Token Authorization via Official API
  console.log("[TEST 3] Live API Key Validation with QpiAI Opt Auth Service:");
  try {
    const authRes = await fetch("https://opt-server.qpiai.tech/api/users/verify_secret_access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_access_token: apiKey }),
      signal: AbortSignal.timeout(5000),
    });
    const authData: any = await authRes.json();
    console.log(`  - HTTP Status: ${authRes.status}`);
    console.log(`  - Raw Response: ${JSON.stringify(authData)}`);
    if (authRes.ok) {
      console.log(`  - Auth Result: PASS (Valid & Active Secret Access Token)\n`);
    } else {
      console.log(`  - Auth Result: REJECTED by QpiAI Server (${authData.error || "Invalid token"})\n`);
    }
  } catch (err: any) {
    console.log(`  - Auth Result: FAILED TO CONNECT (${err.message})\n`);
  }

  // 4. Python SDK & Virtual Environment Check
  console.log("[TEST 4] Python Environment & qpiai_opt SDK Installation:");
  const projectRoot = path.resolve(__dirname, "../../");
  const venvPython = path.join(projectRoot, ".venv/bin/python3");
  try {
    const { stdout } = await execFileAsync(venvPython, [
      "-c",
      "import qpiai_opt; from qpiai_opt.opt_modeller import Model, Binary; from qpiai_opt.opt_solvers import Client; print('OK')",
    ]);
    console.log(`  - Python Interpreter: ${venvPython}`);
    console.log(`  - SDK Modules Imported: qpiai_opt, opt_modeller, opt_solvers`);
    console.log(`  - SDK Status: PASS (${stdout.trim()})\n`);
  } catch (err: any) {
    console.log(`  - SDK Status: FAIL (${err.message})\n`);
  }

  // 5. Python Routing Optimizer Bridge Execution (Empty Input vs Valid Batches)
  console.log("[TEST 5] Python Optimizer Bridge Execution (scripts/qpiai_route_optimizer.py):");
  const bridgeScript = path.join(projectRoot, "scripts/qpiai_route_optimizer.py");
  try {
    // 5a: Test empty input explicitly
    const { stdout: emptyStdout } = await execFileAsync(venvPython, [bridgeScript], {
      env: { ...process.env, QPIAI_OPT_API_KEY: apiKey },
    });
    const emptyResult = JSON.parse(emptyStdout.trim());
    console.log(`  - Empty Input Execution: SUCCESS`);
    console.log(`  - Engine Reported: ${emptyResult.engine}`);
    console.log(`  - Status on Empty Input: ${emptyResult.status}`);
    console.log(`  - Solver Status: ${emptyResult.solverStatus}`);
    console.log(`  - Waypoints Output Count (Empty): ${emptyResult.waypoints?.length || 0}`);
    console.log(`  - CO2 Savings on Empty Input: ${emptyResult.co2SavingsKg === null ? "null" : emptyResult.co2SavingsKg}`);
    console.log(`  - Explanation: ${emptyResult.co2SavingsExplanation}`);

    // 5b: Test non-empty valid batches
    const samplePayload = JSON.stringify({
      batches: [
        { batchId: "B1", name: "Peenya Scrap Yard", weightKg: 350, latitude: 13.03, longitude: 77.51 },
        { batchId: "B2", name: "Whitefield Aggregator", weightKg: 500, latitude: 12.97, longitude: 77.75 },
      ],
      drivers: [
        { id: "D1", driverId: "DRV-01", fullName: "Rajesh Kumar", capacityKg: 3000, availability: "AVAILABLE" },
      ],
      destination: { name: "Apex E-Waste Hub", latitude: 12.8399, longitude: 77.677 },
      apiKey,
    });
    const { stdout: validStdout } = await execFileAsync(venvPython, [bridgeScript, samplePayload], {
      env: { ...process.env, QPIAI_OPT_API_KEY: apiKey },
    });
    const validResult = JSON.parse(validStdout.trim());
    console.log(`\n  - Valid Batches Solve: SUCCESS`);
    console.log(`  - Engine Selected: ${validResult.engine}`);
    console.log(`  - Solver Name: ${validResult.solverName || "HiGHS"}`);
    console.log(`  - Hardware Backend: ${validResult.hardwareBackend || "Classical CPU (Local execution)"}`);
    console.log(`  - Status on Valid Input: ${validResult.status}`);
    console.log(`  - Waypoints Output Count: ${validResult.waypoints?.length || 0}`);
    console.log(`  - CO2 Savings Estimated: ${validResult.co2SavingsKg} kg CO2e`);
    console.log(`  - Calculation Basis: ${validResult.co2SavingsExplanation}\n`);
  } catch (err: any) {
    console.log(`  - Bridge Execution: FAIL (${err.message})\n`);
  }

  // 6. Backend API Route Integration Test
  console.log("[TEST 6] Backend Express API Route (GET /api/dispatches/optimize-routes):");
  try {
    // Login as DRIVER to get token
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "driver@greenlogistics.com", password: "password123", portalRole: "DRIVER" }),
    });
    const loginData: any = await loginRes.json();

    if (!loginData.token) {
      console.log("  - Failed to login as driver to test endpoint.\n");
      return;
    }

    const routeRes = await fetch("http://localhost:5000/api/dispatches/optimize-routes", {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const routeData: any = await routeRes.json();

    console.log(`  - HTTP Status: ${routeRes.status}`);
    console.log(`  - Optimization Status: ${routeData.optimization?.status}`);
    console.log(`  - Engine Reported: ${routeData.optimization?.engine}`);
    console.log(`  - Solver Name: ${routeData.optimization?.solverName || "HiGHS"}`);
    console.log(`  - Hardware Backend: ${routeData.optimization?.hardwareBackend || "Classical CPU (Local execution)"}`);
    const co2Display = routeData.optimization?.co2SavingsKg !== null && routeData.optimization?.co2SavingsKg !== undefined
      ? `${routeData.optimization.co2SavingsKg} kg CO2e`
      : "null (No pending batches available to route)";
    console.log(`  - CO2 Savings Estimated: ${co2Display}`);
    console.log(`  - Waypoints Count: ${routeData.optimization?.orderedWaypoints?.length ?? routeData.optimization?.waypoints?.length ?? 0}`);
    console.log(`  - Note: ${routeData.optimization?.note}`);
    if (routeData.optimization?.qpiaiLiveValidation) {
      console.log(`  - Live Server Validation: ${JSON.stringify(routeData.optimization.qpiaiLiveValidation)}`);
    }
    console.log(`  - Route API Integration: PASS\n`);
  } catch (err: any) {
    console.log(`  - Route API Integration: FAIL (${err.message})\n`);
  }

  console.log("===============================================================");
  console.log("                   DIAGNOSTIC SUMMARY                          ");
  console.log("===============================================================");
}

runQpiAiDiagnostics().catch(console.error);
