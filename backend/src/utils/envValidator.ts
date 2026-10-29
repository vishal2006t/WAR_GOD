export interface EnvValidationResult {
  valid: boolean;
  missingRequired: string[];
  configuredOptional: string[];
  databaseType: "MongoDB" | "Unknown";
  qpiaiConfigured: boolean;
}

export function validateEnvironment(): EnvValidationResult {
  const requiredVars = ["MONGODB_URI", "JWT_SECRET"];
  const missingRequired: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName]?.trim() === "") {
      missingRequired.push(varName);
    }
  }

  const mongoUri = process.env.MONGODB_URI || "";
  const databaseType = mongoUri.startsWith("mongodb") ? "MongoDB" : "Unknown";

  const qpiaiKey = process.env.QPIAI_OPT_API_KEY;
  const qpiaiConfigured = !!(qpiaiKey && qpiaiKey.trim().length > 0);

  const osrmUrl = process.env.OSRM_ROUTING_URL?.trim();
  const osrmConfigured = !!(osrmUrl && osrmUrl.length > 0);

  const googleKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  const googleConfigured = !!(googleKey && googleKey.length > 0);

  const configuredOptional: string[] = [];
  if (process.env.BLOCKCHAIN_RPC_URL) configuredOptional.push("BLOCKCHAIN_RPC_URL");
  if (process.env.CONTRACT_ADDRESS) configuredOptional.push("CONTRACT_ADDRESS");
  if (qpiaiConfigured) configuredOptional.push("QPIAI_OPT_API_KEY");
  if (osrmConfigured) configuredOptional.push("OSRM_ROUTING_URL");
  if (googleConfigured) configuredOptional.push("GOOGLE_MAPS_SERVER_API_KEY");

  // Safe startup logging: Never print actual values of keys/passwords!
  console.log("=== EcoTrace Environment Audit ===");
  console.log(` Database Engine: ${databaseType} (${mongoUri ? "Configured" : "MISSING"})`);
  console.log(` Database Target: ${mongoUri.includes("127.0.0.1") || mongoUri.includes("localhost") ? "Local MongoDB (ecotrace)" : "MongoDB Atlas"}`);
  console.log(` Blockchain Node: ${process.env.BLOCKCHAIN_RPC_URL || "Default Localhost"}`);
  console.log(` Contract Address: ${process.env.CONTRACT_ADDRESS ? "Configured" : "Not Set"}`);
  console.log(
    ` Google Routes API v2: ${
      googleConfigured
        ? "Configured (Google Routes API Compute Routes Active)"
        : "Not Set (Using OpenStreetMap OSRM no-billing router)"
    }`
  );
  console.log(
    ` Road Routing Service: OpenStreetMap OSRM (${
      osrmConfigured ? osrmUrl : "Default Public Router: https://router.project-osrm.org"
    }) - No Google Billing Required`
  );
  console.log(
    ` QpiAI Opt Engine: ${
      qpiaiConfigured
        ? "Configured (Quantum/AI Route Optimization Active)"
        : "Optional / Not Set (Using Local Heuristic Route Optimization)"
    }`
  );
  console.log("==================================");

  if (missingRequired.length > 0) {
    console.error(
      `[SECURITY ERROR] Missing required environment variables: ${missingRequired.join(
        ", "
      )}. Please configure them in your .env file.`
    );
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    configuredOptional,
    databaseType,
    qpiaiConfigured,
  };
}
