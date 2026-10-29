export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteDestination {
  lat?: number;
  lng?: number;
  address?: string;
}

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteResult {
  success: boolean;
  configured: boolean;
  routingEngine: "OSRM_OPENSTREETMAP" | "BROUTER_OPENSTREETMAP";
  distanceKm?: number;
  distanceMeters?: number;
  durationMinutes?: number;
  durationText?: string;
  coordinates?: RouteCoordinate[];
  summary?: string;
  source: "OSRM" | "BROUTER" | "CACHED" | "FALLBACK";
  isRoadRoute: boolean;
  error?: string;
  notice?: string;
}

interface CachedRoute {
  timestamp: number;
  result: RouteResult;
}

interface CachedGeocode {
  timestamp: number;
  coords: LatLng | null;
}

class OsmRoutingService {
  private routeCache: Map<string, CachedRoute> = new Map();
  private geocodeCache: Map<string, CachedGeocode> = new Map();
  private readonly ROUTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
  private readonly GEOCODE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour geocode cache
  private readonly TIMEOUT_MS = 5000; // 5-second abort timeout

  /**
   * Returns configured OSRM routing base URL.
   * Defaults to public OSRM router; configurable via OSRM_ROUTING_URL.
   */
  public getRoutingUrl(): string {
    const configured = process.env.OSRM_ROUTING_URL?.trim();
    if (configured && configured.length > 0) {
      return configured.replace(/\/+$/, "");
    }
    return "https://router.project-osrm.org";
  }

  /**
   * Geocode a text address to [lat, lng] using OpenStreetMap Nominatim.
   * Respects OSM usage policy with descriptive User-Agent and aggressive caching.
   */
  public async geocodeAddress(address: string): Promise<LatLng | null> {
    const cleanAddr = address.trim();
    if (!cleanAddr) return null;

    const cacheKey = cleanAddr.toLowerCase();
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.GEOCODE_CACHE_TTL_MS) {
      return cached.coords;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanAddr
      )}&limit=1`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EcoTrace-Circular-Platform/1.0 (contact@ecotrace.org)",
          Accept: "application/json",
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        this.geocodeCache.set(cacheKey, { timestamp: Date.now(), coords: null });
        return null;
      }

      const data: any = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const coords: LatLng = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
        this.geocodeCache.set(cacheKey, { timestamp: Date.now(), coords });
        return coords;
      }

      this.geocodeCache.set(cacheKey, { timestamp: Date.now(), coords: null });
      return null;
    } catch (err) {
      console.warn(`[OSM Geocode] Failed to geocode address: "${cleanAddr}"`, err);
      return null;
    }
  }

  /**
   * Compute actual road route, road distance, and travel time using OpenStreetMap OSRM / BRouter.
   * Cascades through open routing services to guarantee high reliability.
   */
  public async computeRoadRoute(
    origin: LatLng,
    destination: RouteDestination
  ): Promise<RouteResult> {
    let destCoords: LatLng | null = null;

    if (
      typeof destination.lat === "number" &&
      typeof destination.lng === "number" &&
      !isNaN(destination.lat) &&
      !isNaN(destination.lng)
    ) {
      destCoords = { lat: destination.lat, lng: destination.lng };
    } else if (destination.address) {
      destCoords = await this.geocodeAddress(destination.address);
    }

    if (!destCoords) {
      return {
        success: false,
        configured: true,
        routingEngine: "OSRM_OPENSTREETMAP",
        isRoadRoute: false,
        source: "FALLBACK",
        error: "Destination coordinates could not be resolved from address.",
        notice: "Please share valid GPS coordinates or a recognized street address.",
      };
    }

    // Cache key rounded to ~11m (4 decimals) to consolidate micro-movements
    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destCoords.lat.toFixed(
      4
    )},${destCoords.lng.toFixed(4)}`;

    const cached = this.routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ROUTE_CACHE_TTL_MS) {
      return { ...cached.result, source: "CACHED" };
    }

    // Attempt 1: OSRM Routing Engine
    try {
      const osrmResult = await this.callOsrm(origin, destCoords);
      if (osrmResult.success) {
        this.routeCache.set(cacheKey, { timestamp: Date.now(), result: osrmResult });
        return osrmResult;
      }
    } catch (osrmErr: any) {
      // OSRM failed or demo server unreachable — cascade to OpenStreetMap BRouter
    }

    // Attempt 2: OpenStreetMap BRouter Engine
    try {
      const brouterResult = await this.callBRouter(origin, destCoords);
      if (brouterResult.success) {
        this.routeCache.set(cacheKey, { timestamp: Date.now(), result: brouterResult });
        return brouterResult;
      }
    } catch (brouterErr: any) {
      console.warn(`[OSM Routing] All routing providers unreachable: ${brouterErr.message}`);
    }

    // Attempt 3: Graceful fallback alert (Never fake road distance!)
    return {
      success: false,
      configured: true,
      routingEngine: "OSRM_OPENSTREETMAP",
      isRoadRoute: false,
      source: "FALLBACK",
      error: "Road routing service temporarily unavailable. Showing direct path.",
      notice:
        "Estimated road distance and turn-by-turn route could not be calculated. Displaying approximate direct path.",
    };
  }

  private async callOsrm(origin: LatLng, destCoords: LatLng): Promise<RouteResult> {
    const baseUrl = this.getRoutingUrl();
    const osrmUrl = `${baseUrl}/route/v1/driving/${origin.lng},${origin.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    const res = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "EcoTrace-Circular-Platform/1.0 (contact@ecotrace.org)",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`OSRM HTTP ${res.status}`);
    }

    const data: any = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || `No drivable road route found`);
    }

    const bestRoute = data.routes[0];
    const distanceMeters = Math.round(bestRoute.distance);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));
    const durationSeconds = Math.round(bestRoute.duration);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    const coordinates: RouteCoordinate[] = (bestRoute.geometry?.coordinates || []).map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );

    return {
      success: true,
      configured: true,
      routingEngine: "OSRM_OPENSTREETMAP",
      distanceKm,
      distanceMeters,
      durationMinutes,
      durationText: `${durationMinutes} mins (Estimated Road Travel)`,
      coordinates,
      summary: bestRoute.legs?.[0]?.summary || "OpenStreetMap OSRM Road Route",
      source: "OSRM",
      isRoadRoute: true,
    };
  }

  private async callBRouter(origin: LatLng, destCoords: LatLng): Promise<RouteResult> {
    const brouterUrl = `https://brouter.de/brouter?lonlats=${origin.lng},${origin.lat}|${destCoords.lng},${destCoords.lat}&profile=car-eco&alternativeidx=0&format=geojson`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    const res = await fetch(brouterUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "EcoTrace-Circular-Platform/1.0 (contact@ecotrace.org)",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`BRouter HTTP ${res.status}`);
    }

    const data: any = await res.json();
    const feature = data.features?.[0];
    if (!feature || !feature.geometry?.coordinates) {
      throw new Error("No BRouter geometry feature found");
    }

    const trackLength = parseFloat(feature.properties?.["track-length"] || "0");
    const totalTimeSec = parseFloat(feature.properties?.["total-time"] || "0");
    const distanceKm = Number((trackLength / 1000).toFixed(2));
    const durationMinutes = Math.max(1, Math.round(totalTimeSec / 60));

    const coordinates: RouteCoordinate[] = feature.geometry.coordinates.map(
      (c: number[]) => ({ lat: c[1], lng: c[0] })
    );

    return {
      success: true,
      configured: true,
      routingEngine: "OSRM_OPENSTREETMAP",
      distanceKm,
      distanceMeters: Math.round(trackLength),
      durationMinutes,
      durationText: `${durationMinutes} mins (Estimated Road Travel)`,
      coordinates,
      summary: feature.properties?.name || "OpenStreetMap Road Route",
      source: "BROUTER",
      isRoadRoute: true,
    };
  }
}

export const osmRoutingService = new OsmRoutingService();
