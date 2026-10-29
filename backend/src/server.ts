import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import batchRoutes from "./routes/batch.routes";
import dispatchRoutes from "./routes/dispatch.routes";
import receivingRoutes from "./routes/receiving.routes";
import processingRoutes from "./routes/processing.routes";
import materialsRoutes from "./routes/materials.routes";
import productRoutes from "./routes/product.routes";
import adminRoutes from "./routes/admin.routes";
import evidenceRoutes from "./routes/evidence.routes";
import notificationRoutes from "./routes/notification.routes";
import driverRoutes from "./routes/driver.routes";
import marketplaceRoutes from "./routes/marketplace.routes";
import mapsRoutes from "./routes/maps.routes";
import driverAIRoutes from "./routes/driverAI.routes";
import { errorHandler } from "./middleware/errorHandler";
import { validateEnvironment } from "./utils/envValidator";
import { connectMongo } from "./database/mongo";

dotenv.config();

const envStatus = validateEnvironment();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads serving
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health & System status
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "EcoTrace Backend API",
    version: "1.0.0",
    database: {
      type: envStatus.databaseType,
      status: "connected",
    },
    blockchain: {
      network: "Hardhat Local EVM (31337)",
      contractConfigured: !!process.env.CONTRACT_ADDRESS,
    },
    qpiaiOpt: {
      configured: envStatus.qpiaiConfigured,
      mode: envStatus.qpiaiConfigured
        ? "Quantum_AI_Opt"
        : "Local_Heuristic_Planner",
    },
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/dispatches", dispatchRoutes);
app.use("/api/receiving", receivingRoutes);
app.use("/api/processing", processingRoutes);
app.use("/api/materials", materialsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/maps", mapsRoutes);
app.use("/api/driver-ai", driverAIRoutes);
app.get("/api/health", (req, res) => res.redirect("/health"));

// Error Handler
app.use(errorHandler);

async function startServer() {
  try {
    await connectMongo();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` EcoTrace Backend Server running on port ${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(` Database: MongoDB (${process.env.MONGODB_URI ? "Connected" : "Default"})`);
      console.log(` Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`====================================================`);
    });
  } catch (err: any) {
    console.error("[Fatal Startup Error] Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}

startServer();

export default app;
