import { osmRoutingService, RouteCoordinate } from "./osmRouting";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteDestination {
  lat?: number;
  lng?: number;
  address?: string;
}

export interface ComputedRouteResult {
  success: boolean;
  configured: boolean;
  isRoadRoute?: boolean;
  distanceKm?: number;
  distanceMeters?: number;
  durationMinutes?: number;
  durationText?: string;
  polyline?: string;
  coordinates?: RouteCoordinate[];
  summary?: string;
  source?: "GOOGLE_ROUTES_API" | "OSRM_OPENSTREETMAP" | "BROUTER_OPENSTREETMAP" | "CACHED" | "DIRECT_FALLBACK" | "OSRM" | "BROUTER" | "FALLBACK";
  error?: string;
  notice?: string;
  setupInstructions?: string;
}

class GoogleMapsService {
  private cache = new Map<string, { timestamp: number; result: ComputedRouteResult }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  public isServerKeyConfigured(): boolean {
    const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
    return !!(key && key.trim().length > 0);
  }

  /**
   * Compute actual road route, distance, and duration using Google Maps Routes API v2 (Compute Routes).
   * Never exposes the server API key in client responses, logs, or error messages.
   */
  public async computeRoadRoute(
    origin: LatLng,
    destination: RouteDestination
  ): Promise<ComputedRouteResult> {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();

    if (!apiKey) {
      // Fall back to OSM routing service if Google key is not configured
      const osmResult = await osmRoutingService.computeRoadRoute(origin, destination);
      return {
        ...osmResult,
        configured: false,
        setupInstructions:
          "Google Maps Server API key is not configured. Displaying OpenStreetMap no-billing road route.",
      };
    }

    // Generate cache key (rounded to ~11 meters to group micro-movements)
    const destStr =
      destination.lat && destination.lng
        ? `${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`
        : destination.address || "unknown";
    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destStr}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return { ...cached.result, source: "CACHED" };
    }

    // Call modern Google Routes API v2 (computeRoutes)
    try {
      const routesResult = await this.callRoutesApiV2(apiKey, origin, destination);
      if (routesResult.success) {
        this.cache.set(cacheKey, { timestamp: Date.now(), result: routesResult });
        return routesResult;
      }

      // If Google Routes API returned a specific error (e.g. quota, permissions),
      // we attempt OSM routing as a fallback so the user is never left without road routes
      console.warn(
        `[Google Maps Routes API] Failed (${routesResult.error}). Attempting OpenStreetMap fallback.`
      );
      const osmFallback = await osmRoutingService.computeRoadRoute(origin, destination);
      if (osmFallback.success) {
        return {
          ...osmFallback,
          configured: true,
          setupInstructions: `Google Routes API notice: ${routesResult.error}. Successfully loaded OpenStreetMap road route as fallback.`,
        };
      }

      return routesResult;
    } catch (err: any) {
      console.warn("[Google Maps Routes API] Exception:", err.message);
      // Fallback to OSM
      const osmFallback = await osmRoutingService.computeRoadRoute(origin, destination);
      if (osmFallback.success) {
        return {
          ...osmFallback,
          configured: true,
          setupInstructions:
            "Google Routes API unreachable. Successfully loaded OpenStreetMap road route as fallback.",
        };
      }

      return {
        success: false,
        configured: true,
        isRoadRoute: false,
        error: `Routes API error: ${err.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Calls Google Routes API v2 (computeRoutes endpoint).
   * Replaces deprecated Directions API. Uses X-Goog-FieldMask header.
   */
  private async callRoutesApiV2(
    apiKey: string,
    origin: LatLng,
    destination: RouteDestination
  ): Promise<ComputedRouteResult> {
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

    const originPayload = {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    };

    let destinationPayload: any;
    if (destination.lat && destination.lng) {
      destinationPayload = {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
        },
      };
    } else if (destination.address) {
      destinationPayload = {
        address: destination.address,
      };
    } else {
      return {
        success: false,
        configured: true,
        isRoadRoute: false,
        error: "Destination must have latitude/longitude or valid address.",
      };
    }

    const res = await (globalThis.fetch || fetch)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description",
      },
      body: JSON.stringify({
        origin: originPayload,
        destination: destinationPayload,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      // Sanitize error message to avoid leaking any key or internal URL parameters
      const errorMsg = data.error?.message || `HTTP ${res.status}`;
      return {
        success: false,
        configured: true,
        isRoadRoute: false,
        error: `Google Routes API error: ${errorMsg}`,
      };
    }

    if (!data.routes || data.routes.length === 0) {
      return {
        success: false,
        configured: true,
        isRoadRoute: false,
        error: "No road route found between origin and destination.",
      };
    }

    const route = data.routes[0];
    const distanceMeters = route.distanceMeters || 0;
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;

    // Parse duration format: e.g. "3415s"
    let durationSeconds = 0;
    if (typeof route.duration === "string") {
      durationSeconds = parseInt(route.duration.replace("s", ""), 10) || 0;
    } else if (typeof route.duration === "number") {
      durationSeconds = route.duration;
    }
    const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const durationText = `${durationMinutes} mins (Estimated Traffic)`;

    return {
      success: true,
      configured: true,
      isRoadRoute: true,
      distanceKm,
      distanceMeters,
      durationMinutes,
      durationText,
      polyline: route.polyline?.encodedPolyline,
      summary: route.description || "Fastest road route via Google Routes API",
      source: "GOOGLE_ROUTES_API",
    };
  }
}

export const googleMapsService = new GoogleMapsService();
