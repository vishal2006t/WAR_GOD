import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { PickupTaskModel, ProductListingModel } from "../models";
import { googleMapsService } from "../services/googleMaps";
import { osmRoutingService } from "../services/osmRouting";

const router = Router();

// GET /api/maps/config - Public check returning routing engine status
router.get("/config", (req: Request, res: Response) => {
  const googleConfigured = googleMapsService.isServerKeyConfigured();
  res.json({
    success: true,
    routingEngine: googleConfigured ? "GOOGLE_ROUTES_API" : "OSRM_OPENSTREETMAP",
    serverRoutesApiConfigured: googleConfigured,
    provider: googleConfigured ? "Google Maps Routes API v2" : "OpenStreetMap OSRM",
    routingUrl: osmRoutingService.getRoutingUrl(),
    osmRoutingUrl: osmRoutingService.getRoutingUrl(),
  });
});

// POST /api/maps/route - Compute road route with Routes API
router.post(
  "/route",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { origin, destination, taskId } = req.body;

      if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number") {
        res.status(400).json({
          success: false,
          error: "Origin must contain valid latitude and longitude numbers.",
        });
        return;
      }

      if (!destination || (!destination.lat && !destination.address)) {
        res.status(400).json({
          success: false,
          error: "Destination must contain coordinates (lat/lng) or an address string.",
        });
        return;
      }

      // If taskId is provided, verify role access
      if (taskId) {
        const task = await PickupTaskModel.findOne({ taskId }).lean();
        if (task) {
          const isAuthorized =
            user.role === "ADMIN" ||
            task.driverId === user.id ||
            task.dealerId === user.id;

          if (!isAuthorized) {
            res.status(403).json({
              success: false,
              error: "Unauthorized: You do not have permission to view route for this task.",
            });
            return;
          }
        }
      }

      const result = await googleMapsService.computeRoadRoute(origin, destination);
      res.json(result);
    } catch (err: any) {
      console.error("Error computing road route:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to compute road route",
      });
    }
  }
);

// GET /api/maps/pickup-route/:taskId - Dedicated route for active pickup task
router.get(
  "/pickup-route/:taskId",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { taskId } = req.params;

      const task = await PickupTaskModel.findOne({
        $or: [{ taskId }, { _id: taskId.match(/^[0-9a-fA-F]{24}$/) ? taskId : undefined }],
      }).lean();

      if (!task) {
        res.status(404).json({ success: false, error: "Pickup task not found" });
        return;
      }

      // Authorization check
      let isCustomerOwner = false;
      if (user.role === "CUSTOMER") {
        const listing = await ProductListingModel.findOne({ listingId: task.listingId }).lean();
        isCustomerOwner = listing?.customerId === user.id;
      }

      const isAuthorized =
        user.role === "ADMIN" ||
        task.driverId === user.id ||
        task.dealerId === user.id ||
        isCustomerOwner;

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          error: "Unauthorized: You do not have permission to view this route.",
        });
        return;
      }

      // Origin: driver's last known location
      const driverLat = task.lastKnownLocation?.latitude;
      const driverLng = task.lastKnownLocation?.longitude;

      if (!driverLat || !driverLng) {
        res.status(400).json({
          success: false,
          error: "Driver has not yet shared live GPS location for this pickup.",
        });
        return;
      }

      // Destination: Customer pickup coordinates or address
      const destCoords = task.pickupCoordinates?.coordinates;
      const destination = destCoords && destCoords.length === 2
        ? { lat: destCoords[1], lng: destCoords[0], address: task.pickupAddress }
        : { address: task.pickupAddress };

      const result = await googleMapsService.computeRoadRoute(
        { lat: driverLat, lng: driverLng },
        destination
      );

      // If road route succeeded, update task with live road distance and ETA
      if (result.success && result.distanceKm && result.durationMinutes) {
        await PickupTaskModel.updateOne(
          { taskId: task.taskId },
          {
            $set: {
              distanceKm: result.distanceKm,
              etaMinutes: result.durationMinutes,
            },
          }
        );
      }

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching pickup route:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to fetch pickup route",
      });
    }
  }
);

export default router;
