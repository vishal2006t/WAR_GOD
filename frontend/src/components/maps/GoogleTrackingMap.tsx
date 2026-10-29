import React, { useEffect, useRef, useState } from "react";
import {
  loadGoogleMaps,
  getGoogleMapsBrowserApiKey,
  decodePolyline,
  isGoogleMapsAuthFailed,
  getGoogleMapsAuthError,
} from "../../utils/googleMapsLoader";
import { api } from "../../services/api";
import { EcoTrackingMap } from "./EcoTrackingMap";
import {
  MapPin,
  Navigation,
  Compass,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
  Layers,
  KeyRound,
  RefreshCw,
  Info,
} from "lucide-react";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GoogleTrackingMapProps {
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

export const GoogleTrackingMap: React.FC<GoogleTrackingMapProps> = ({
  driverLocation,
  customerLocation,
  taskId,
  customerName = "Customer Pickup",
  driverName = "Assigned Driver",
  height = "380px",
  className = "",
  interactive = true,
  onRouteComputed,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [keyMissing, setKeyMissing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMinutes: number;
    durationText: string;
    summary?: string;
    isRoadRoute: boolean;
    source?: string;
  } | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [useOsmFallback, setUseOsmFallback] = useState<boolean>(false);

  // Listen for Google Maps SDK authentication failures
  useEffect(() => {
    const handleAuthFailure = (e: any) => {
      const err = e?.detail?.error || "Google Maps authorization error";
      console.warn("[GoogleTrackingMap] Intercepted Google Maps auth failure:", err);
      setAuthError(err);
      setUseOsmFallback(true);
      setLoading(false);
    };

    window.addEventListener("google-maps-auth-failure", handleAuthFailure);
    return () => {
      window.removeEventListener("google-maps-auth-failure", handleAuthFailure);
    };
  }, []);

  // Initialize and load Google Maps SDK
  useEffect(() => {
    let isMounted = true;
    const apiKey = getGoogleMapsBrowserApiKey();

    if (!apiKey) {
      setKeyMissing(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setKeyMissing(false);
    setAuthError(null);

    loadGoogleMaps(apiKey)
      .then((googleMaps) => {
        if (!isMounted || !mapContainerRef.current) return;

        if (isGoogleMapsAuthFailed()) {
          setAuthError(getGoogleMapsAuthError());
          setUseOsmFallback(true);
          setLoading(false);
          return;
        }

        // Center on driver, or customer, or default Bengaluru
        const centerLat = driverLocation?.lat || customerLocation?.lat || 12.9716;
        const centerLng = driverLocation?.lng || customerLocation?.lng || 77.5946;

        if (!mapInstanceRef.current) {
          const map = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: centerLat, lng: centerLng },
            zoom: 13,
            disableDefaultUI: !interactive,
            zoomControl: interactive,
            mapTypeControl: interactive,
            streetViewControl: false,
            fullscreenControl: interactive,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ lightness: 20 }],
              },
            ],
          });
          mapInstanceRef.current = map;
        }

        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.warn("[GoogleTrackingMap] Initialization error:", err.message);
        if (err.message.includes("MISSING_KEY")) {
          setKeyMissing(true);
        } else {
          setAuthError(err.message);
          setUseOsmFallback(true);
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update Markers and Calculate Road Route
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    const google = window.google;
    const map = mapInstanceRef.current;

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    // 1. Driver Marker
    if (driverLocation && driverLocation.lat && driverLocation.lng) {
      const driverPos = { lat: driverLocation.lat, lng: driverLocation.lng };
      bounds.extend(driverPos);
      hasCoords = true;

      const driverIcon = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#075B46", // EcoTrace forest green
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#FFFFFF",
        rotation: 0,
      };

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new google.maps.Marker({
          position: driverPos,
          map,
          title: `${driverName} (Live GPS)`,
          icon: driverIcon,
        });
      } else {
        driverMarkerRef.current.setPosition(driverPos);
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }

    // 2. Customer Destination Marker
    if (customerLocation && customerLocation.lat && customerLocation.lng) {
      const destPos = { lat: customerLocation.lat, lng: customerLocation.lng };
      bounds.extend(destPos);
      hasCoords = true;

      const destIcon = {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#E11D48", // Destination Red
        fillOpacity: 1,
        strokeWeight: 1.5,
        strokeColor: "#FFFFFF",
        scale: 1.5,
        anchor: new google.maps.Point(12, 22),
      };

      if (!destMarkerRef.current) {
        destMarkerRef.current = new google.maps.Marker({
          position: destPos,
          map,
          title: `${customerName} (Pickup Location)`,
          icon: destIcon,
        });
      } else {
        destMarkerRef.current.setPosition(destPos);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null);
      destMarkerRef.current = null;
    }

    // 3. Auto-fit bounds if we have coordinates
    if (hasCoords) {
      if (
        driverLocation?.lat &&
        customerLocation?.lat &&
        (driverLocation.lat !== customerLocation.lat ||
          driverLocation.lng !== customerLocation.lng)
      ) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else if (driverLocation?.lat) {
        map.setCenter({ lat: driverLocation.lat, lng: driverLocation.lng });
        map.setZoom(14);
      }
    }

    // 4. Compute Road Route via Backend Google Routes API v2
    if (driverLocation?.lat && (customerLocation?.lat || customerLocation?.address)) {
      computeRoute(driverLocation, customerLocation);
    }
  }, [driverLocation?.lat, driverLocation?.lng, customerLocation?.lat, customerLocation?.lng]);

  const computeRoute = async (
    origin: LatLng,
    dest: { lat?: number; lng?: number; address?: string }
  ) => {
    try {
      setRoutingError(null);
      const data = await api.computeRoadRoute({
        origin,
        destination: dest,
        taskId,
      });

      if (data && data.success) {
        const isRoad = data.isRoadRoute !== false;
        const info = {
          distanceKm: data.distanceKm || 0,
          durationMinutes: data.durationMinutes || 0,
          durationText: data.durationText || `${data.durationMinutes} mins`,
          summary: data.summary,
          isRoadRoute: isRoad,
          source: data.source,
        };
        setRouteInfo(info);
        if (data.setupInstructions) {
          setSetupNotice(data.setupInstructions);
        }

        if (onRouteComputed) {
          onRouteComputed(info);
        }

        // Draw Route Polyline on Map
        let pathPoints: Array<{ lat: number; lng: number }> = [];

        if (data.polyline && typeof data.polyline === "string") {
          pathPoints = decodePolyline(data.polyline);
        } else if (data.coordinates && Array.isArray(data.coordinates)) {
          pathPoints = data.coordinates.map((c: any) =>
            Array.isArray(c) ? { lat: c[1], lng: c[0] } : { lat: c.lat, lng: c.lng }
          );
        } else if (origin.lat && dest.lat && dest.lng) {
          pathPoints = [
            { lat: origin.lat, lng: origin.lng },
            { lat: dest.lat, lng: dest.lng },
          ];
        }

        if (pathPoints.length > 0 && mapInstanceRef.current && window.google?.maps) {
          const google = window.google;
          if (routePolylineRef.current) {
            routePolylineRef.current.setMap(null);
          }

          const polyline = new google.maps.Polyline({
            path: pathPoints,
            geodesic: true,
            strokeColor: isRoad ? "#075B46" : "#D97706", // Green for road route, Amber for fallback
            strokeOpacity: 0.85,
            strokeWeight: isRoad ? 5 : 3,
            icons: !isRoad
              ? [
                  {
                    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                    offset: "0",
                    repeat: "16px",
                  },
                ]
              : undefined,
          });

          polyline.setMap(mapInstanceRef.current);
          routePolylineRef.current = polyline;

          // Fit bounds to polyline
          const polyBounds = new google.maps.LatLngBounds();
          pathPoints.forEach((pt) => polyBounds.extend(pt));
          mapInstanceRef.current.fitBounds(polyBounds, 40);
        }
      } else {
        setRoutingError(data?.error || "Unable to compute road route.");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Failed to load road route.";
      setRoutingError(msg);
    }
  };

  // If user chooses OpenStreetMap no-billing fallback
  if (useOsmFallback) {
    return (
      <div className="relative">
        <div className="mb-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-800">
          <span className="flex items-center gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Showing OpenStreetMap (No Google Billing Required)
          </span>
          <button
            onClick={() => setUseOsmFallback(false)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
          >
            Switch to Google Maps Demo
          </button>
        </div>
        <EcoTrackingMap
          driverLocation={driverLocation}
          customerLocation={customerLocation}
          taskId={taskId}
          customerName={customerName}
          driverName={driverName}
          height={height}
          className={className}
          onRouteComputed={onRouteComputed}
        />
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border border-[#D8E8DC] shadow-sm bg-white ${className}`}>
      {/* Route & Status Header Overlay */}
      <div className="bg-gradient-to-r from-[#075B46] to-[#0A7355] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-200"></span>
          </span>
          <span className="font-semibold tracking-wide">
            Google Maps & Routes API v2
          </span>
          <span className="bg-emerald-800/80 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-emerald-200">
            {routeInfo?.source || "Live Tracking"}
          </span>
        </div>

        {routeInfo && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded">
              <Compass className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                <strong className="text-white">{routeInfo.distanceKm} km</strong>
                <span className="text-emerald-100/80 ml-1">
                  {routeInfo.isRoadRoute ? "Road Distance" : "Direct (approx)"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                <strong className="text-white">{routeInfo.durationMinutes} min</strong>
                <span className="text-emerald-100/80 ml-1">ETA (Traffic)</span>
              </span>
            </div>
          </div>
        )}

        {/* Switch to OSM button */}
        <button
          onClick={() => setUseOsmFallback(true)}
          className="ml-auto text-[11px] bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded transition text-emerald-50 flex items-center gap-1 font-medium"
          title="Switch to Leaflet OpenStreetMap"
        >
          <Layers className="w-3 h-3" />
          Switch to OpenStreetMap
        </button>
      </div>

      {/* Info Notice Banner if any */}
      {setupNotice && (
        <div className="bg-blue-50 border-b border-blue-200 px-3 py-1.5 text-xs text-blue-800 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span>{setupNotice}</span>
        </div>
      )}

      {/* Fallback Notice Banner */}
      {routeInfo && !routeInfo.isRoadRoute && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>
            Direct route shown. Google Routes API or geocoding could not resolve road network.
          </span>
        </div>
      )}

      {/* Routing Error Alert */}
      {routingError && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-1.5 text-xs text-red-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            {routingError}
          </span>
          <button
            onClick={() => setUseOsmFallback(true)}
            className="text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Use OpenStreetMap
          </button>
        </div>
      )}

      {/* Map Canvas / State Fallbacks */}
      <div className="relative w-full" style={{ height }}>
        {/* Missing API Key State */}
        {keyMissing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">
              Google Maps Browser API Key Required
            </h4>
            <p className="text-xs text-slate-500 max-w-md mb-4">
              To render the interactive Google Map, configure{" "}
              <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">
                VITE_GOOGLE_MAPS_API_KEY
              </code>{" "}
              in <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">frontend/.env</code>.
            </p>
            <button
              onClick={() => setUseOsmFallback(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#075B46] text-white text-xs font-medium rounded-lg hover:bg-[#0A7355] transition shadow-sm"
            >
              <Layers className="w-3.5 h-3.5" />
              Switch to Free OpenStreetMap
            </button>
          </div>
        )}

        {/* Authentication / Quota Error State */}
        {authError && !keyMissing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">
              Google Maps Authentication / Billing Error
            </h4>
            <p className="text-xs text-slate-500 max-w-md mb-4">
              {authError}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUseOsmFallback(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#075B46] text-white text-xs font-medium rounded-lg hover:bg-[#0A7355] transition shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                View Map on OpenStreetMap (No Billing)
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px]">
            <RefreshCw className="w-7 h-7 text-[#075B46] animate-spin mb-2" />
            <span className="text-xs text-slate-600 font-medium">
              Loading Google Street Map & Road Routes...
            </span>
          </div>
        )}

        {/* Actual Google Map DOM Container */}
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ width: "100%", height, minHeight: height }}
        />
      </div>

      {/* Footer Info / CSP Note */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Live GPS Geolocation Active • Modern Google Routes API v2</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Strict CSP Enforced • No Unsafe Eval
        </div>
      </div>
    </div>
  );
};
