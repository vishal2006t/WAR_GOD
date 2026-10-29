import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { api } from "../../services/api";
import {
  MapPin,
  Navigation,
  Compass,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
  Layers,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EcoTrackingMapProps {
  driverLocation?: LatLng | null;
  customerLocation?: { lat?: number; lng?: number; address?: string } | null;
  taskId?: string;
  customerName?: string;
  driverName?: string;
  height?: string;
  className?: string;
  interactive?: boolean;
  onRouteComputed?: (info: {
    distanceKm: number;
    durationMinutes: number;
    durationText: string;
  }) => void;
}

// Configurable OpenStreetMap Tile Layer and Attribution (No Google billing or keys required)
const DEFAULT_TILE_URL =
  (import.meta as any).env?.VITE_MAP_TILE_URL ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_ATTRIBUTION =
  (import.meta as any).env?.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

// Helper to auto-fit bounds on coordinate updates
const AutoBoundsController: React.FC<{
  bounds: L.LatLngBoundsExpression | null;
}> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [bounds, map]);

  // Invalidate size to guarantee no grey tiles in modal/accordion containers
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

// Custom EcoTrace Leaflet DivIcons (Vector-styled, zero image dependencies)
const createDriverIcon = () =>
  L.divIcon({
    className: "ecotrace-driver-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px;">
        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: rgba(16, 185, 129, 0.3); animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
        <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; background-color: #075B46; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: center; color: white;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  });

const createCustomerIcon = () =>
  L.divIcon({
    className: "ecotrace-customer-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 44px;">
        <div style="width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background-color: #087F5B; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center;">
          <div style="transform: rotate(45deg); color: white; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });

export const EcoTrackingMap: React.FC<EcoTrackingMapProps> = ({
  driverLocation,
  customerLocation,
  taskId,
  customerName = "Customer Pickup",
  driverName = "Carrier Driver",
  height = "380px",
  className = "",
  interactive = true,
  onRouteComputed,
}) => {
  // Route Telemetry State
  const [roadPoints, setRoadPoints] = useState<[number, number][]>([]);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [estimatedDurationText, setEstimatedDurationText] = useState<string | null>(null);
  const [isRoadRoute, setIsRoadRoute] = useState<boolean>(true);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [resolvedCustomerCoords, setResolvedCustomerCoords] = useState<LatLng | null>(null);

  // Throttling references
  const lastOriginRef = useRef<LatLng | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Fallback center if coordinates are pending
  const defaultCenter: [number, number] = [12.9716, 77.5946]; // Bengaluru hub default

  // Determine active coordinates
  const activeDriverCoords = useMemo(() => {
    if (
      driverLocation &&
      typeof driverLocation.lat === "number" &&
      typeof driverLocation.lng === "number" &&
      !isNaN(driverLocation.lat) &&
      !isNaN(driverLocation.lng)
    ) {
      return driverLocation;
    }
    return null;
  }, [driverLocation]);

  const activeCustomerCoords = useMemo(() => {
    if (
      customerLocation &&
      typeof customerLocation.lat === "number" &&
      typeof customerLocation.lng === "number" &&
      !isNaN(customerLocation.lat) &&
      !isNaN(customerLocation.lng)
    ) {
      return { lat: customerLocation.lat, lng: customerLocation.lng };
    }
    return resolvedCustomerCoords;
  }, [customerLocation, resolvedCustomerCoords]);

  // Compute road route via backend OSRM service
  const fetchRoute = async (force = false) => {
    if (!activeDriverCoords) return;

    // Check if driver displacement is under 150m and query is under 60s cooldown
    if (!force && lastOriginRef.current && Date.now() - lastTimeRef.current < 60000) {
      const dLat = Math.abs(activeDriverCoords.lat - lastOriginRef.current.lat);
      const dLng = Math.abs(activeDriverCoords.lng - lastOriginRef.current.lng);
      if (dLat < 0.0013 && dLng < 0.0013) {
        return; // Skip redundant API request
      }
    }

    setCalculatingRoute(true);
    setRouteError(null);

    try {
      let routeData: any = null;

      if (taskId) {
        try {
          routeData = await api.getPickupRoute(taskId);
        } catch {
          // Fallback to direct route endpoint
        }
      }

      if (!routeData || !routeData.success) {
        routeData = await api.computeRoadRoute({
          origin: activeDriverCoords,
          destination: customerLocation || { lat: 12.9352, lng: 77.6245 },
          taskId,
        });
      }

      if (routeData && routeData.success && routeData.coordinates && routeData.coordinates.length > 0) {
        // Convert to Leaflet [lat, lng] format
        const points: [number, number][] = routeData.coordinates.map(
          (c: { lat: number; lng: number }) => [c.lat, c.lng]
        );
        setRoadPoints(points);
        setRoadDistanceKm(routeData.distanceKm || null);
        setEstimatedDurationText(routeData.durationText || null);
        setIsRoadRoute(true);

        lastOriginRef.current = activeDriverCoords;
        lastTimeRef.current = Date.now();

        if (routeData.distanceKm && routeData.durationMinutes && onRouteComputed) {
          onRouteComputed({
            distanceKm: routeData.distanceKm,
            durationMinutes: routeData.durationMinutes,
            durationText: routeData.durationText,
          });
        }
      } else {
        // Road routing unavailable: fallback to direct connection
        setIsRoadRoute(false);
        setRouteError(routeData?.error || "Road route unavailable. Showing direct path.");

        if (activeCustomerCoords) {
          setRoadPoints([
            [activeDriverCoords.lat, activeDriverCoords.lng],
            [activeCustomerCoords.lat, activeCustomerCoords.lng],
          ]);
        }
      }
    } catch (err: any) {
      setIsRoadRoute(false);
      setRouteError("Road route service currently unavailable. Showing direct line.");
      if (activeCustomerCoords) {
        setRoadPoints([
          [activeDriverCoords.lat, activeDriverCoords.lng],
          [activeCustomerCoords.lat, activeCustomerCoords.lng],
        ]);
      }
    } finally {
      setCalculatingRoute(false);
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [activeDriverCoords, customerLocation, taskId]);

  // Compute map bounds to enclose both driver and customer markers
  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const pointsToBound: [number, number][] = [];
    if (activeDriverCoords) pointsToBound.push([activeDriverCoords.lat, activeDriverCoords.lng]);
    if (activeCustomerCoords) pointsToBound.push([activeCustomerCoords.lat, activeCustomerCoords.lng]);

    if (pointsToBound.length >= 2) {
      return L.latLngBounds(pointsToBound);
    } else if (pointsToBound.length === 1) {
      return L.latLngBounds([
        [pointsToBound[0][0] - 0.015, pointsToBound[0][1] - 0.015],
        [pointsToBound[0][0] + 0.015, pointsToBound[0][1] + 0.015],
      ]);
    }
    return null;
  }, [activeDriverCoords, activeCustomerCoords]);

  const mapCenter: [number, number] = useMemo(() => {
    if (activeDriverCoords) return [activeDriverCoords.lat, activeDriverCoords.lng];
    if (activeCustomerCoords) return [activeCustomerCoords.lat, activeCustomerCoords.lng];
    return defaultCenter;
  }, [activeDriverCoords, activeCustomerCoords]);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#D7E5DB] bg-[#EDF7EF] shadow-sm flex flex-col ${className}`}
      style={{ height }}
    >
      {/* Top Telemetry & Status Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {/* Road Distance Badge */}
          {roadDistanceKm != null && isRoadRoute && (
            <div className="px-2.5 py-1 rounded-xl bg-white/95 backdrop-blur border border-[#D7E5DB] shadow-sm flex items-center gap-1.5 text-xs font-semibold text-[#075B46]">
              <Navigation className="w-3.5 h-3.5 text-[#075B46]" />
              <span>{roadDistanceKm} km (Road Distance)</span>
            </div>
          )}

          {/* Travel Duration Badge */}
          {estimatedDurationText && isRoadRoute && (
            <div className="px-2.5 py-1 rounded-xl bg-[#075B46] text-white border border-[#075B46] shadow-sm flex items-center gap-1.5 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-[#A3E635]" />
              <span>{estimatedDurationText}</span>
            </div>
          )}

          {/* Routing Source Badge */}
          <div className="px-2 py-1 rounded-xl bg-white/90 backdrop-blur border border-[#D7E5DB] shadow-sm flex items-center gap-1 text-[11px] font-medium text-[#6B7C74]">
            <Compass className="w-3 h-3 text-[#075B46]" />
            <span>OSRM • OpenStreetMap</span>
          </div>
        </div>

        {/* Action / Refresh Button */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => fetchRoute(true)}
            disabled={calculatingRoute}
            className="p-1.5 rounded-xl bg-white/95 backdrop-blur border border-[#D7E5DB] text-[#6B7C74] hover:text-[#173C32] hover:bg-[#E5F5EA] shadow-sm transition-all"
            title="Refresh Road Route"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${calculatingRoute ? "animate-spin text-[#075B46]" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Fallback Road Notice */}
      {!isRoadRoute && routeError && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] pointer-events-auto px-3 py-2 rounded-xl bg-amber-50/95 backdrop-blur border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{routeError}</span>
          </span>
          <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
            Direct Path
          </span>
        </div>
      )}

      {/* Interactive Leaflet Map */}
      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        zoomControl={interactive}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      >
        <TileLayer url={DEFAULT_TILE_URL} attribution={DEFAULT_ATTRIBUTION} maxZoom={19} />

        <AutoBoundsController bounds={bounds} />

        {/* Driver Current Location Marker */}
        {activeDriverCoords && (
          <Marker
            position={[activeDriverCoords.lat, activeDriverCoords.lng]}
            icon={createDriverIcon()}
          >
            <Popup className="ecotrace-popup">
              <div className="text-xs p-1">
                <div className="font-bold text-[#075B46] flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{driverName}</span>
                </div>
                <div className="text-[11px] text-[#6B7C74] mt-0.5 font-mono">
                  {activeDriverCoords.lat.toFixed(5)}, {activeDriverCoords.lng.toFixed(5)}
                </div>
                <div className="text-[10px] text-emerald-700 mt-1 font-semibold">
                  Live Carrier GPS
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Customer Pickup Destination Marker */}
        {activeCustomerCoords && (
          <Marker
            position={[activeCustomerCoords.lat, activeCustomerCoords.lng]}
            icon={createCustomerIcon()}
          >
            <Popup className="ecotrace-popup">
              <div className="text-xs p-1">
                <div className="font-bold text-[#075B46] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{customerName}</span>
                </div>
                {customerLocation?.address && (
                  <div className="text-[11px] text-[#173C32] mt-0.5 max-w-[200px]">
                    {customerLocation.address}
                  </div>
                )}
                <div className="text-[10px] text-emerald-700 mt-1 font-semibold">
                  Collection Point
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Road-following Route Polyline */}
        {roadPoints.length >= 2 && (
          <Polyline
            positions={roadPoints}
            pathOptions={{
              color: isRoadRoute ? "#075B46" : "#D97706",
              weight: isRoadRoute ? 5 : 3.5,
              opacity: isRoadRoute ? 0.85 : 0.7,
              dashArray: isRoadRoute ? undefined : "8, 8",
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};
