import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  Truck,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  ArrowRight,
  Clock,
  Layers,
  XCircle,
  Upload,
  FileText,
  X,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Scale,
  Pause,
  Play,
  Wifi,
  WifiOff,
  Radio,
  Compass,
  ShieldCheck,
  Check,
  Info,
  User,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Tag,
  Shield,
  Activity,
} from "lucide-react";
import { DriverCustomerPickupsSection } from "../../components/marketplace/DriverCustomerPickupsSection";
import { GoogleTrackingMap } from "../../components/maps/GoogleTrackingMap";

type DriverTab = "overview" | "customer-pickups" | "trips" | "completed" | "notes";

export const DriverDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<DriverTab>("overview");
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Driver Profile & Availability State
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  // In-Card Drawers State
  const [expandedMapDispatchId, setExpandedMapDispatchId] = useState<string | null>(null);
  const [expandedBreaksDispatchId, setExpandedBreaksDispatchId] = useState<string | null>(null);
  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);

  // Live GPS Telemetry State
  const [activeTrackingDispatchId, setActiveTrackingDispatchId] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"IDLE" | "ACTIVE" | "ON_BREAK" | "DENIED" | "OFFLINE" | "ERROR" | "SUSPENDED">("IDLE");
  const [lastGpsCoords, setLastGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  } | null>(null);
  const [lastGpsSuccessTime, setLastGpsSuccessTime] = useState<Date | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [tabSuspended, setTabSuspended] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Feedback Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [rejectModalDispatch, setRejectModalDispatch] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pickupModalDispatch, setPickupModalDispatch] = useState<any | null>(null);
  const [pickupWeightInput, setPickupWeightInput] = useState("");
  const [deliveryModalDispatch, setDeliveryModalDispatch] = useState<any | null>(null);
  const [deliveryWeightInput, setDeliveryWeightInput] = useState("");
  const [deliveryProofUrl, setDeliveryProofUrl] = useState("");
  const [exceptionModalDispatch, setExceptionModalDispatch] = useState<any | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");

  // Break Modal State
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakModalDispatch, setBreakModalDispatch] = useState<any | null>(null);
  const [breakReason, setBreakReason] = useState("Mandatory Rest Period");
  const [customBreakReason, setCustomBreakReason] = useState("");

  // Sync tab with React Router location.hash
  useEffect(() => {
    const h = location.hash.replace("#", "").toLowerCase() as DriverTab;
    if (["overview", "customer-pickups", "trips", "completed", "notes"].includes(h)) {
      setActiveTab(h);
    } else if (!h) {
      setActiveTab("overview");
    }
  }, [location.hash]);

  const navigateTab = (tab: DriverTab) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`);
  };

  useEffect(() => {
    loadDispatches();
    loadDriverProfile();
  }, []);

  const loadDriverProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await api.getDriverMe();
      if (res.success && res.driver) {
        setDriverProfile(res.driver);
      }
    } catch (err) {
      console.warn("Could not load driver profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!driverProfile) return;
    const current = driverProfile.availability || "AVAILABLE";
    if (current === "ON_TRIP") {
      setActionError("Cannot switch duty status while on an active cargo trip. Complete delivery first.");
      setTimeout(() => setActionError(null), 5000);
      return;
    }
    const target = current === "AVAILABLE" ? "OFF_DUTY" : "AVAILABLE";
    try {
      setTogglingAvailability(true);
      const res = await api.updateDriverAvailability(driverProfile.id || driverProfile._id, target);
      if (res.success) {
        setDriverProfile((prev: any) => ({ ...prev, availability: target }));
        setActionSuccess(`Duty status switched to ${target === "AVAILABLE" ? "AVAILABLE (Ready for Dispatch)" : "OFF DUTY (Resting)"}.`);
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(res.error || "Failed to update availability");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update duty availability");
    } finally {
      setTogglingAvailability(false);
    }
  };

  const handleCopyOtp = (otp: string, id: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOtpId(id);
    setTimeout(() => setCopiedOtpId(null), 3000);
  };

  const loadDispatches = async () => {
    setLoading(true);
    try {
      const res = await api.getDispatches();
      if (res.success) {
        setDispatches(res.dispatches);
        // Auto-select active transit shipment if not set
        const activeOne = res.dispatches.find((d: any) =>
          ["IN_TRANSIT", "ARRIVED_AT_FACTORY", "ON_BREAK"].includes(d.status)
        );
        if (activeOne) {
          setActiveTrackingDispatchId(activeOne.id);
          if (activeOne.status === "ON_BREAK") setGpsStatus("ON_BREAK");
          else setGpsStatus("ACTIVE");
        }
      }
    } catch (err) {
      console.error("Failed to load driver dispatches:", err);
    } finally {
      setLoading(false);
    }
  };

  // Online / Offline & Tab Visibility Listeners
  useEffect(() => {
    const handleOnline = () => {
      if (activeTrackingDispatchId) setGpsStatus("ACTIVE");
    };
    const handleOffline = () => {
      setGpsStatus("OFFLINE");
      setGpsError("Network connection offline. GPS updates will resume when reconnected.");
    };
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSuspended(true);
        if (gpsStatus === "ACTIVE") setGpsStatus("SUSPENDED");
      } else {
        setTabSuspended(false);
        if (activeTrackingDispatchId) {
          setGpsStatus("ACTIVE");
          transmitCurrentLocation();
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeTrackingDispatchId, gpsStatus]);

  // Transmit location helper
  const transmitCurrentLocation = () => {
    if (!activeTrackingDispatchId) return;
    if (!navigator.geolocation) {
      setGpsStatus("ERROR");
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        setLastGpsCoords({
          latitude,
          longitude,
          heading: heading ?? undefined,
          speed: speed ?? undefined,
          accuracy,
        });
        setGpsError(null);
        setGpsStatus("ACTIVE");

        try {
          await api.updateDispatchLocation(activeTrackingDispatchId, {
            latitude,
            longitude,
            heading: heading ?? undefined,
            speed: speed ?? undefined,
            accuracy,
            timestamp: new Date(pos.timestamp).toISOString(),
          });
          setLastGpsSuccessTime(new Date());
        } catch (err: any) {
          console.warn("Failed to transmit GPS:", err.message);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("DENIED");
          setGpsError("Location permission denied. Please allow GPS access in your browser settings.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsStatus("ERROR");
          setGpsError("GPS position unavailable from device sensors.");
        } else if (err.code === err.TIMEOUT) {
          setGpsStatus("ERROR");
          setGpsError("GPS signal request timed out.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  };

  // Periodic Telemetry Interval
  useEffect(() => {
    if (!activeTrackingDispatchId) return;

    const activeDispatch = dispatches.find((d) => d.id === activeTrackingDispatchId);
    if (!activeDispatch || activeDispatch.status === "DELIVERED" || activeDispatch.status === "RECEIVED") {
      return;
    }

    if (activeDispatch.status === "ON_BREAK") {
      setGpsStatus("ON_BREAK");
      return;
    }

    transmitCurrentLocation();

    const interval = setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        transmitCurrentLocation();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTrackingDispatchId, dispatches]);

  const handleTripAction = async (
    dispatchId: string,
    action: "START_TRIP" | "START_BREAK" | "RESUME_TRIP" | "COMPLETE_TRIP",
    reason?: string
  ) => {
    setUpdating(true);
    setActionError(null);
    setActionSuccess(null);

    let location: { latitude: number; longitude: number } | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 10000,
          });
        });
        location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setLastGpsCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          accuracy: pos.coords.accuracy,
        });
      } catch {
        if (lastGpsCoords) {
          location = { latitude: lastGpsCoords.latitude, longitude: lastGpsCoords.longitude };
        }
      }
    }

    try {
      const res = await api.tripAction(dispatchId, {
        action,
        reason,
        location,
      });

      if (res.success) {
        if (action === "START_TRIP" || action === "RESUME_TRIP") {
          setActiveTrackingDispatchId(dispatchId);
          setGpsStatus("ACTIVE");
        } else if (action === "START_BREAK") {
          setGpsStatus("ON_BREAK");
        } else if (action === "COMPLETE_TRIP") {
          setActiveTrackingDispatchId(null);
          setGpsStatus("IDLE");
        }

        setIsBreakModalOpen(false);
        setBreakModalDispatch(null);
        setBreakReason("Mandatory Rest Period");
        setCustomBreakReason("");
        setActionSuccess(`Trip action '${action.replace("_", " ")}' updated successfully.`);
        setTimeout(() => setActionSuccess(null), 5000);
        await loadDispatches();
      } else {
        setActionError(res.error || `Failed to record ${action}`);
      }
    } catch (err: any) {
      setActionError(err.message || `Failed to record ${action}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStatus = async (
    dispatchId: string,
    payload: {
      status: string;
      pickupWeightKg?: number;
      deliveryWeightKg?: number;
      rejectionReason?: string;
      exceptionReason?: string;
      deliveryProofUrl?: string;
      discrepancyNotes?: string;
    }
  ) => {
    setUpdating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.updateDispatchStatus(dispatchId, payload);
      if (res.success) {
        setRejectModalDispatch(null);
        setRejectionReason("");
        setPickupModalDispatch(null);
        setPickupWeightInput("");
        setDeliveryModalDispatch(null);
        setDeliveryWeightInput("");
        setDeliveryProofUrl("");
        setExceptionModalDispatch(null);
        setExceptionReason("");
        setActionSuccess(`Shipment status advanced to ${payload.status} successfully.`);
        setTimeout(() => setActionSuccess(null), 5000);
        loadDispatches();
      } else {
        setActionError(res.error || "Failed to update shipment status");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update dispatch status");
    } finally {
      setUpdating(false);
    }
  };

  const activeTrips = dispatches.filter(
    (d) =>
      [
        "ASSIGNED",
        "ACCEPTED",
        "EN_ROUTE",
        "PICKED_UP",
        "IN_TRANSIT",
        "ON_BREAK",
        "ARRIVED_AT_FACTORY",
        "EXCEPTION",
      ].includes(d.status)
  );
  const completedTrips = dispatches.filter(
    (d) => ["DELIVERED", "RECEIVED"].includes(d.status)
  );
  const exceptionTrips = dispatches.filter(
    (d) => d.status === "EXCEPTION" || d.status === "DISPUTED" || d.exceptionReason
  );

  // Filtered dispatches based on activeTab
  let displayedDispatches = dispatches;
  if (activeTab === "trips") displayedDispatches = activeTrips;
  if (activeTab === "completed") displayedDispatches = completedTrips;
  if (activeTab === "notes") displayedDispatches = exceptionTrips;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayedDispatches = displayedDispatches.filter(
      (d) =>
        d.dispatchId?.toLowerCase().includes(q) ||
        d.vehicleRegistration?.toLowerCase().includes(q) ||
        d.pickupAddress?.toLowerCase().includes(q) ||
        d.destinationFacility?.name?.toLowerCase().includes(q)
    );
  }

  if (loading && dispatches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#173C32]">Transporter & Driver Desk</h1>
          <p className="text-xs text-[#6B7C74] mt-1 font-sans">
            Assigned dispatches, vehicle manifests, status telemetry, and digital chain-of-custody handovers.
          </p>
        </div>

        <button
          onClick={() => {
            loadDispatches();
            loadDriverProfile();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E5F5EA] hover:bg-[#EDF7EF] text-[#075B46] text-xs font-semibold border border-[#D7E5DB] transition-all self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#087F5B]" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-[#075B46] text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#087F5B] shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Driver Profile & Duty Availability Card */}
      <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Driver identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-[#E5F5EA] border border-[#D7E5DB] flex items-center justify-center text-[#075B46]">
                <Truck className="w-6 h-6" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  driverProfile?.availability === "AVAILABLE"
                    ? "bg-emerald-500"
                    : driverProfile?.availability === "ON_TRIP"
                    ? "bg-blue-500"
                    : "bg-gray-400"
                }`}
                title={`Duty Status: ${driverProfile?.availability || "AVAILABLE"}`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-[#173C32]">
                  {driverProfile?.fullName || driverProfile?.name || "Rajesh Kumar"}
                </h2>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EDF7EF] border border-[#D7E5DB] text-[#075B46]">
                  {driverProfile?.driverId || "DRV-KA-8822"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  <span>{driverProfile?.rating || "4.9"}</span>
                </span>
                <span className="text-[11px] text-[#6B7C74] font-mono">
                  ({driverProfile?.totalCompletedTrips || completedTrips.length} completed trips)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#6B7C74] mt-1 flex-wrap font-sans">
                <span>Lic: <strong className="text-[#173C32]">{driverProfile?.licenseNumber || "DL-KA-2022-7711"}</strong></span>
                <span>•</span>
                <span>Vehicle: <strong className="text-[#173C32] font-mono">{driverProfile?.vehicleRegistration || "KA-04-ET-8822"}</strong> ({driverProfile?.vehicleType?.replace("_", " ") || "Heavy Truck"})</span>
                <span>•</span>
                <span>Max Payload: <strong className="text-[#173C32]">{(driverProfile?.loadCapacityKg || 5000).toLocaleString()} kg</strong></span>
              </div>
            </div>
          </div>

          {/* Interactive Duty Availability Toggle */}
          <div className="flex items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-[#D7E5DB] justify-between md:justify-end">
            <div className="text-left md:text-right">
              <span className="text-[10px] uppercase tracking-wider text-[#6B7C74] font-mono block">Duty Availability</span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border mt-0.5 ${
                  driverProfile?.availability === "AVAILABLE"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : driverProfile?.availability === "ON_TRIP"
                    ? "bg-blue-50 text-blue-800 border-blue-300"
                    : "bg-gray-100 text-gray-700 border-gray-300"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    driverProfile?.availability === "AVAILABLE"
                      ? "bg-emerald-500 animate-pulse"
                      : driverProfile?.availability === "ON_TRIP"
                      ? "bg-blue-500"
                      : "bg-gray-400"
                  }`}
                />
                {driverProfile?.availability === "AVAILABLE" && "AVAILABLE (Ready for Dispatch)"}
                {driverProfile?.availability === "ON_TRIP" && "ON TRIP (Cargo in Transit)"}
                {driverProfile?.availability === "OFF_DUTY" && "OFF DUTY (Resting)"}
                {!["AVAILABLE", "ON_TRIP", "OFF_DUTY"].includes(driverProfile?.availability) && (driverProfile?.availability || "AVAILABLE")}
              </span>
            </div>

            {driverProfile?.availability !== "ON_TRIP" && (
              <button
                onClick={handleToggleAvailability}
                disabled={togglingAvailability}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
                  driverProfile?.availability === "AVAILABLE"
                    ? "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300"
                    : "bg-[#087F5B] hover:bg-[#075B46] text-white border-[#087F5B]"
                }`}
              >
                {togglingAvailability
                  ? "Updating..."
                  : driverProfile?.availability === "AVAILABLE"
                  ? "Go Off-Duty"
                  : "Go Available"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Assigned Trips"
          value={activeTrips.length}
          subtitle="In custody, transit, or pending"
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Total Payload Transported"
          value={`${dispatches.reduce((acc, d) => acc + (d.dispatchedWeightKg || 0), 0).toFixed(1)} kg`}
          subtitle="Cumulative cargo mass"
          icon={Navigation}
          color="emerald"
        />
        <StatCard
          title="Completed Handovers"
          value={completedTrips.length}
          subtitle="Delivered to facility intake"
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      {/* Horizontal Sub-Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#D7E5DB] pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: "overview", label: "Transport Desk Overview", icon: Layers },
          { id: "customer-pickups", label: "Customer Pickups", icon: Navigation },
          { id: "trips", label: `Assigned Trips (${activeTrips.length})`, icon: Truck },
          { id: "completed", label: `Completed Handovers (${completedTrips.length})`, icon: CheckCircle2 },
          { id: "notes", label: `Exception Reports (${exceptionTrips.length})`, icon: ShieldAlert },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateTab(tab.id as DriverTab)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-semibold shadow-sm"
                : "text-[#6B7C74] hover:text-[#173C32] hover:bg-[#EDF7EF]"
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#075B46]" : "text-[#6B7C74]"}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CUSTOMER PICKUPS SECTION */}
      {activeTab === "customer-pickups" && <DriverCustomerPickupsSection />}

      {/* Search Filter Bar (for freight dispatches) */}
      {activeTab !== "customer-pickups" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
          <input
            type="text"
            placeholder="Search by Dispatch ID, vehicle registration plate, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
          />
        </div>
        <span className="text-xs font-mono text-[#6B7C74]">
          Showing {displayedDispatches.length} shipments
        </span>
      </div>

      {/* Live GPS Telemetry Dashboard Bar */}
      {activeTrackingDispatchId && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#173C32] text-white shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    gpsStatus === "ACTIVE"
                      ? "bg-emerald-400"
                      : gpsStatus === "ON_BREAK"
                      ? "bg-amber-400"
                      : "bg-rose-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    gpsStatus === "ACTIVE"
                      ? "bg-emerald-500"
                      : gpsStatus === "ON_BREAK"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    Active Telemetry Broadcast
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
                    Shipment #{dispatches.find((d) => d.id === activeTrackingDispatchId)?.dispatchId || "Active"}
                  </span>
                </div>
                <p className="text-[11px] text-white/70 mt-0.5">
                  Sensor loop active. Transmitting timestamped coordinates to EcoTrace fleet backend every 10 seconds.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={transmitCurrentLocation}
                disabled={updating}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 flex items-center gap-1.5 transition-all"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Send GPS Ping</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[10px] text-white/60 font-mono uppercase flex items-center gap-1">
                <Compass className="w-3 h-3 text-emerald-400" /> GPS Lock Status
              </span>
              <p className="font-semibold text-white">
                {gpsStatus === "ACTIVE" && "Broadcasting Live"}
                {gpsStatus === "ON_BREAK" && "Paused (Driver on Break)"}
                {gpsStatus === "SUSPENDED" && "Tab Inactive / Throttled"}
                {gpsStatus === "DENIED" && "Permission Denied"}
                {gpsStatus === "OFFLINE" && "Offline (Queued)"}
                {gpsStatus === "ERROR" && "Sensor Error"}
                {gpsStatus === "IDLE" && "Standby"}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[10px] text-white/60 font-mono uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" /> Last Successful Sync
              </span>
              <p className="font-semibold font-mono text-white">
                {lastGpsSuccessTime
                  ? `${lastGpsSuccessTime.toLocaleTimeString()} (${Math.max(
                      0,
                      Math.round((Date.now() - lastGpsSuccessTime.getTime()) / 1000)
                    )}s ago)`
                  : "Awaiting first fix"}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[10px] text-white/60 font-mono uppercase flex items-center gap-1">
                <Navigation className="w-3 h-3 text-emerald-400" /> Position Coordinates
              </span>
              <p className="font-semibold font-mono text-white truncate">
                {lastGpsCoords
                  ? `${lastGpsCoords.latitude.toFixed(4)}°, ${lastGpsCoords.longitude.toFixed(4)}°`
                  : "Acquiring..."}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <span className="text-[10px] text-white/60 font-mono uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Accuracy & Margin
              </span>
              <p className="font-semibold font-mono text-white">
                {lastGpsCoords?.accuracy
                  ? `±${Math.round(lastGpsCoords.accuracy)}m ${
                      lastGpsCoords.accuracy <= 50 ? "(High)" : "(Fair)"
                    }`
                  : "Checking fix..."}
              </p>
            </div>
          </div>

          {gpsError && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
              <span>{gpsError}</span>
            </div>
          )}

          <div className="text-[11px] text-white/60 flex items-center gap-1.5 pt-1">
            <Info className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>
              Browser Geolocation is active while this tab is foregrounded. Background tracking depends on device OS policies.
            </span>
          </div>
        </div>
      )}

      {/* Dispatches Cards Grid */}
      {displayedDispatches.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-[#D7E5DB] shadow-card text-center text-xs text-[#6B7C74] space-y-2">
          <Truck className="w-8 h-8 mx-auto text-[#6B7C74] mb-2" />
          <p className="font-semibold text-[#173C32]">No shipments found matching the selected view.</p>
          <p className="text-[11px] text-[#6B7C74]">
            {activeTab === "trips" && "No active transport trips pending pickup or transit."}
            {activeTab === "completed" && "No past deliveries recorded yet."}
            {activeTab === "notes" && "No transit exceptions or discrepancy reports logged."}
            {activeTab === "overview" && "No dispatches currently assigned to your account."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedDispatches.map((dispatch) => {
            const status = dispatch.status;

            return (
              <div
                key={dispatch.id}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-[#D7E5DB] shadow-card space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#D7E5DB]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#075B46] text-sm">{dispatch.dispatchId}</span>
                      <span className="text-xs text-[#6B7C74] font-mono px-2 py-0.5 rounded bg-[#EDF7EF] border border-[#D7E5DB]">
                        {dispatch.vehicleRegistration}
                      </span>
                      {dispatch.batches?.[0]?.batch?.priority && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                          {dispatch.batches[0].batch.priority} PRIORITY
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={dispatch.status} size="sm" />
                    </div>
                  </div>

                  {/* Assignment Timestamp & Cargo Category */}
                  <div className="flex items-center justify-between text-xs text-[#6B7C74] flex-wrap gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#087F5B]" />
                      <span>Assigned: {new Date(dispatch.createdAt).toLocaleDateString()} {new Date(dispatch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#173C32] bg-[#EDF7EF] px-2 py-0.5 rounded-full border border-[#D7E5DB]">
                      <Tag className="w-3 h-3 text-[#087F5B]" />
                      <span>{dispatch.batches?.[0]?.batch?.category?.name || "High-Grade E-Waste & Circuitry"}</span>
                    </span>
                  </div>

                  {/* Route & Cargo Weight Manifest */}
                  <div className="p-3.5 rounded-xl bg-[#EDF7EF]/50 border border-[#D7E5DB] text-xs space-y-2.5">
                    <div className="flex items-start gap-2 text-[#173C32]">
                      <MapPin className="w-3.5 h-3.5 text-[#087F5B] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#6B7C74] block">Pickup Origin</span>
                        <span className="font-medium">{dispatch.pickupAddress}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-[#173C32]">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#6B7C74] block">Destination Facility</span>
                        <span className="font-medium">
                          {dispatch.destinationFacility?.name || "Apex Recycling Hub"}
                        </span>
                        {dispatch.destinationFacility?.address && (
                          <span className="text-[11px] text-[#6B7C74] block">
                            {dispatch.destinationFacility.address}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#D7E5DB] font-mono text-[11px]">
                      <div>
                        <span className="text-[10px] text-[#6B7C74] block">Dispatched Mass:</span>
                        <span className="text-[#173C32] font-bold">{dispatch.dispatchedWeightKg} kg</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#6B7C74] block">Pickup Scale:</span>
                        <span className="text-[#087F5B] font-bold">
                          {dispatch.pickupWeightKg ? `${dispatch.pickupWeightKg} kg` : "Pending"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#6B7C74] block">Gate Scale:</span>
                        <span className="text-blue-600 font-bold">
                          {dispatch.deliveryWeightKg ? `${dispatch.deliveryWeightKg} kg` : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dispatch.pickupAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB] text-xs font-semibold transition-all shadow-xs"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#087F5B]" />
                      <span>Navigate to Pickup</span>
                      <ExternalLink className="w-3 h-3 text-[#6B7C74]" />
                    </a>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        dispatch.destinationFacility?.address || dispatch.destinationFacility?.name || "Apex Recycling Hub, Bengaluru"
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EDF7EF] text-blue-700 border border-[#D7E5DB] text-xs font-semibold transition-all shadow-xs"
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Navigate to Factory</span>
                      <ExternalLink className="w-3 h-3 text-[#6B7C74]" />
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMapDispatchId(expandedMapDispatchId === dispatch.id ? null : dispatch.id)
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
                        expandedMapDispatchId === dispatch.id
                          ? "bg-[#087F5B] text-white border-[#087F5B]"
                          : "bg-white hover:bg-[#EDF7EF] text-[#173C32] border-[#D7E5DB]"
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>{expandedMapDispatchId === dispatch.id ? "Hide Map" : "Live Route Map"}</span>
                    </button>
                  </div>

                  {/* In-Card Interactive Map */}
                  {expandedMapDispatchId === dispatch.id && (
                    <div className="rounded-xl overflow-hidden border border-[#D7E5DB] shadow-sm animate-fadeIn">
                      <GoogleTrackingMap
                        driverName={driverProfile?.fullName || "Carrier Driver"}
                        customerName={dispatch.destinationFacility?.name || "Destination Factory"}
                        driverLocation={
                          lastGpsCoords
                            ? { lat: lastGpsCoords.latitude, lng: lastGpsCoords.longitude }
                            : dispatch.lastKnownLocation?.latitude && dispatch.lastKnownLocation?.longitude
                            ? { lat: dispatch.lastKnownLocation.latitude, lng: dispatch.lastKnownLocation.longitude }
                            : { lat: 12.8399, lng: 77.677 }
                        }
                        customerLocation={{
                          lat:
                            dispatch.destinationFacility?.location?.latitude ||
                            dispatch.destinationFacility?.coordinates?.coordinates?.[1] ||
                            12.985,
                          lng:
                            dispatch.destinationFacility?.location?.longitude ||
                            dispatch.destinationFacility?.coordinates?.coordinates?.[0] ||
                            77.74,
                          address: dispatch.destinationFacility?.address || dispatch.pickupAddress,
                        }}
                        height="260px"
                      />
                    </div>
                  )}

                  {/* Gate Delivery Handover OTP Banner */}
                  {dispatch.deliveryConfirmationOtp && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-700" />
                          <span className="text-xs font-semibold text-emerald-900">
                            Factory Gate Delivery Handover OTP
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyOtp(dispatch.deliveryConfirmationOtp, dispatch.id)}
                          className="text-[11px] font-mono text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-semibold"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedOtpId === dispatch.id ? "Copied!" : "Copy"}</span>
                        </button>
                      </div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-2xl font-mono font-bold tracking-widest text-[#075B46] bg-white px-3 py-1 rounded-lg border border-emerald-300 shadow-xs inline-block self-start sm:self-auto">
                          {dispatch.deliveryConfirmationOtp}
                        </span>
                        <span className="text-[11px] text-emerald-800 max-w-[280px]">
                          Present this code to the factory scale operator upon arrival. Only authorized factory staff can verify and confirm delivery receipt.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expandable Break History & Delivery Instructions Drawer */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBreaksDispatchId(
                          expandedBreaksDispatchId === dispatch.id ? null : dispatch.id
                        )
                      }
                      className="text-xs text-[#075B46] font-semibold flex items-center gap-1 hover:underline"
                    >
                      <span>Break History & Instructions ({dispatch.breaks?.length || 0} breaks)</span>
                      {expandedBreaksDispatchId === dispatch.id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {expandedBreaksDispatchId === dispatch.id && (
                      <div className="mt-2 p-3 rounded-xl bg-gray-50 border border-[#D7E5DB] space-y-2.5 text-xs animate-fadeIn">
                        <div>
                          <span className="font-semibold text-[#173C32] block">Delivery Instructions:</span>
                          <p className="text-[11px] text-[#6B7C74] mt-0.5">
                            Verify cargo moisture seals before transit. Maintain hazardous material isolation. Drive within designated freight corridor. Weigh gross payload at factory weighbridge before Gate OTP handover.
                          </p>
                        </div>
                        {dispatch.breaks && dispatch.breaks.length > 0 ? (
                          <div className="pt-2 border-t border-gray-200 space-y-1.5">
                            <span className="font-semibold text-[#173C32] block">Break Audit Trail:</span>
                            {dispatch.breaks.map((b: any, idx: number) => (
                              <div
                                key={b.breakId || idx}
                                className="p-2 rounded-lg bg-white border border-gray-200 text-[11px] flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium text-amber-800">{b.reason || "Rest Period"}</span>
                                  <p className="text-gray-500 font-mono">
                                    {new Date(b.startTime).toLocaleTimeString()} -{" "}
                                    {b.endTime ? new Date(b.endTime).toLocaleTimeString() : "Ongoing"}
                                  </p>
                                </div>
                                <span className="font-mono text-gray-600 font-semibold">
                                  {b.endTime
                                    ? `${Math.max(
                                        1,
                                        Math.round(
                                          (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000
                                        )
                                      )} min`
                                    : "Active"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-500 italic pt-1 border-t border-gray-200">
                            No breaks logged for this transport run yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {dispatch.exceptionReason && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      <span className="font-bold">Exception: </span>
                      {dispatch.exceptionReason}
                    </div>
                  )}
                  {dispatch.rejectionReason && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      <span className="font-bold">Rejection: </span>
                      {dispatch.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Workflow Action Buttons */}
                <div className="pt-3 border-t border-[#D7E5DB] flex flex-wrap gap-2 items-center justify-between">
                  {status === "ASSIGNED" && (
                    <>
                      <button
                        onClick={() => setRejectModalDispatch(dispatch)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(dispatch.id, { status: "ACCEPTED" })}
                        disabled={updating}
                        className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        Accept Assignment
                      </button>
                    </>
                  )}

                  {status === "ACCEPTED" && (
                    <>
                      <button
                        onClick={() => setExceptionModalDispatch(dispatch)}
                        className="px-3 py-1.5 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] text-xs font-medium transition-colors"
                      >
                        Report Issue
                      </button>
                      <button
                        onClick={() => {
                          setPickupModalDispatch(dispatch);
                          setPickupWeightInput(dispatch.dispatchedWeightKg.toString());
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        Confirm Physical Pickup
                      </button>
                    </>
                  )}

                  {status === "PICKED_UP" && (
                    <>
                      <button
                        onClick={() => setExceptionModalDispatch(dispatch)}
                        className="px-3 py-1.5 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] text-xs font-medium transition-colors"
                      >
                        Report Delay
                      </button>
                      <button
                        onClick={() => handleTripAction(dispatch.id, "START_TRIP")}
                        disabled={updating}
                        className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Trip (Live GPS)</span>
                      </button>
                    </>
                  )}

                  {status === "IN_TRANSIT" && (
                    <div className="w-full flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setBreakModalDispatch(dispatch);
                            setIsBreakModalOpen(true);
                          }}
                          disabled={updating}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Start Break</span>
                        </button>
                        <button
                          onClick={() => setExceptionModalDispatch(dispatch)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] text-xs font-medium transition-colors"
                        >
                          Incident
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTripAction(dispatch.id, "COMPLETE_TRIP")}
                          disabled={updating}
                          className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete Trip</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {status === "ON_BREAK" && (
                    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Pause className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Driver on Break:{" "}
                          <strong className="font-semibold">
                            {dispatch.currentBreak?.reason || "Rest Period"}
                          </strong>
                        </span>
                      </div>
                      <button
                        onClick={() => handleTripAction(dispatch.id, "RESUME_TRIP")}
                        disabled={updating}
                        className="px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume Trip</span>
                      </button>
                    </div>
                  )}

                  {status === "ARRIVED_AT_FACTORY" && (
                    <div className="w-full flex flex-col gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Within Factory Geofence Perimeter
                        </span>
                        {dispatch.deliveryConfirmationOtp && (
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-600 text-white text-xs">
                            Gate OTP: {dispatch.deliveryConfirmationOtp}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        Vehicle position detected within the facility gate geofence. Present OTP code to receiving scale operator.
                      </p>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleTripAction(dispatch.id, "COMPLETE_TRIP")}
                          disabled={updating}
                          className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete Gate Trip</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {["DELIVERED", "RECEIVED"].includes(status) && (
                    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs text-[#6B7C74] font-mono">
                      <span className="flex items-center gap-1 text-[#087F5B] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {status === "RECEIVED" ? "Weighed & Confirmed On-Chain" : "Delivered at Factory Gate"}
                        </span>
                      </span>
                      {dispatch.deliveryConfirmationOtp && (
                        <span className="text-[11px] font-mono text-[#075B46] font-bold">
                          Gate OTP: {dispatch.deliveryConfirmationOtp}
                        </span>
                      )}
                    </div>
                  )}

                  {status === "EXCEPTION" && (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-mono font-semibold">Incident Under Investigation</span>
                      <button
                        onClick={() => {
                          setDeliveryModalDispatch(dispatch);
                          setDeliveryWeightInput((dispatch.pickupWeightKg || dispatch.dispatchedWeightKg).toString());
                        }}
                        className="px-3 py-1 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        Resume Delivery
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}

      {/* Reject Assignment Modal */}
      {rejectModalDispatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-rose-200 shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Dispatch Assignment</span>
              </h3>
              <button onClick={() => setRejectModalDispatch(null)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#6B7C74]">
              Rejecting shipment <span className="font-mono font-bold text-[#075B46]">{rejectModalDispatch.dispatchId}</span> requires a mandatory audit explanation.
            </p>
            <div>
              <label className="block text-[#173C32] text-xs mb-1 font-medium">Rejection Reason</label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Vehicle payload capacity exceeded, mechanical maintenance breakdown, address unreachable..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl p-3 text-xs text-[#173C32] focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#D7E5DB]">
              <button
                type="button"
                onClick={() => setRejectModalDispatch(null)}
                className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-xs text-[#173C32] font-medium border border-[#D7E5DB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || updating}
                onClick={() =>
                  handleUpdateStatus(rejectModalDispatch.id, {
                    status: "REJECTED",
                    rejectionReason,
                  })
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                {updating ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Pickup Modal */}
      {pickupModalDispatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#087F5B]" />
                <span>Confirm Pickup & Weigh Manifest</span>
              </h3>
              <button onClick={() => setPickupModalDispatch(null)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-xs flex justify-between">
              <span className="text-[#6B7C74]">Collector Declared Mass:</span>
              <span className="font-mono text-[#075B46] font-bold">{pickupModalDispatch.dispatchedWeightKg} kg</span>
            </div>
            <div>
              <label className="block text-[#173C32] text-xs mb-1 font-medium">Actual Scale Weight at Pickup (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={pickupWeightInput}
                onChange={(e) => setPickupWeightInput(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl p-3 text-sm font-mono font-bold text-[#087F5B] focus:outline-none focus:border-[#087F5B]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#D7E5DB]">
              <button
                type="button"
                onClick={() => setPickupModalDispatch(null)}
                className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-xs text-[#173C32] font-medium border border-[#D7E5DB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pickupWeightInput || updating}
                onClick={() =>
                  handleUpdateStatus(pickupModalDispatch.id, {
                    status: "PICKED_UP",
                    pickupWeightKg: Number(pickupWeightInput),
                  })
                }
                className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                {updating ? "Saving..." : "Confirm Pickup & Take Custody"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {deliveryModalDispatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#087F5B]" />
                <span>Confirm Delivery at Facility Gate</span>
              </h3>
              <button onClick={() => setDeliveryModalDispatch(null)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-xs flex justify-between">
              <span className="text-[#6B7C74]">Pickup Measured Mass:</span>
              <span className="font-mono text-[#075B46] font-bold">
                {deliveryModalDispatch.pickupWeightKg || deliveryModalDispatch.dispatchedWeightKg} kg
              </span>
            </div>
            <div>
              <label className="block text-[#173C32] text-xs mb-1 font-medium">Gate Scale Delivery Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={deliveryWeightInput}
                onChange={(e) => setDeliveryWeightInput(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl p-3 text-sm font-mono font-bold text-[#173C32] focus:outline-none focus:border-[#087F5B]"
              />
            </div>
            <div>
              <label className="block text-[#173C32] text-xs mb-1 font-medium">Delivery Proof / Receipt Notes (Optional)</label>
              <input
                type="text"
                placeholder="Gate pass number, slip URL, or notes"
                value={deliveryProofUrl}
                onChange={(e) => setDeliveryProofUrl(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl p-3 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#D7E5DB]">
              <button
                type="button"
                onClick={() => setDeliveryModalDispatch(null)}
                className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-xs text-[#173C32] font-medium border border-[#D7E5DB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!deliveryWeightInput || updating}
                onClick={() =>
                  handleUpdateStatus(deliveryModalDispatch.id, {
                    status: "DELIVERED",
                    deliveryWeightKg: Number(deliveryWeightInput),
                    deliveryProofUrl: deliveryProofUrl || undefined,
                  })
                }
                className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                {updating ? "Confirming..." : "Confirm Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Exception Modal */}
      {exceptionModalDispatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-amber-200 shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Log Delivery Exception</span>
              </h3>
              <button onClick={() => setExceptionModalDispatch(null)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#6B7C74]">
              Report an incident or exception for dispatch <span className="font-mono font-bold text-[#075B46]">{exceptionModalDispatch.dispatchId}</span>.
            </p>
            <div>
              <label className="block text-[#173C32] text-xs mb-1 font-medium">Exception Details</label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Weighing scale mismatch, damaged batch containers, site access delayed..."
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl p-3 text-xs text-[#173C32] focus:outline-none focus:border-amber-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#D7E5DB]">
              <button
                type="button"
                onClick={() => setExceptionModalDispatch(null)}
                className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-xs text-[#173C32] font-medium border border-[#D7E5DB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!exceptionReason.trim() || updating}
                onClick={() =>
                  handleUpdateStatus(exceptionModalDispatch.id, {
                    status: "EXCEPTION",
                    exceptionReason,
                  })
                }
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                {updating ? "Logging..." : "Log Exception"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break Action Modal */}
      {isBreakModalOpen && breakModalDispatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-amber-200 shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <Pause className="w-5 h-5 text-amber-600" />
                <span>Start Driver Break</span>
              </h3>
              <button
                onClick={() => {
                  setIsBreakModalOpen(false);
                  setBreakModalDispatch(null);
                }}
                className="text-[#6B7C74] hover:text-[#173C32]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#6B7C74]">
              Logging a break for carrier shipment{" "}
              <span className="font-mono font-bold text-[#075B46]">
                {breakModalDispatch.dispatchId}
              </span>
              . Telemetry transmission will be paused until the trip is resumed.
            </p>

            <div>
              <label className="block text-[#173C32] text-xs mb-1.5 font-medium">Break Category</label>
              <select
                value={breakReason}
                onChange={(e) => setBreakReason(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl p-2.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
              >
                <option value="Mandatory Rest Period">Mandatory Rest Period / Regulatory Pause</option>
                <option value="Meal & Refreshment Break">Meal & Refreshment Break</option>
                <option value="Vehicle Maintenance & Fueling">Vehicle Maintenance & Fueling</option>
                <option value="Traffic Congestion / Roadside Stop">Traffic Congestion / Roadside Stop</option>
                <option value="Other">Custom Reason...</option>
              </select>
            </div>

            {breakReason === "Other" && (
              <div>
                <label className="block text-[#173C32] text-xs mb-1 font-medium">Custom Break Explanation</label>
                <input
                  type="text"
                  placeholder="e.g. Toll plaza queue, tire pressure check..."
                  value={customBreakReason}
                  onChange={(e) => setCustomBreakReason(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl p-2.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                />
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
              <span className="font-semibold text-amber-800 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-600" />
                GPS Break Event Marker
              </span>
              <p className="text-[11px] text-amber-700">
                Current coordinates and timestamp will be permanently logged on the shipment manifest for regulatory compliance.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D7E5DB]">
              <button
                type="button"
                onClick={() => {
                  setIsBreakModalOpen(false);
                  setBreakModalDispatch(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-xs text-[#173C32] font-medium border border-[#D7E5DB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() =>
                  handleTripAction(
                    breakModalDispatch.id,
                    "START_BREAK",
                    breakReason === "Other" ? customBreakReason : breakReason
                  )
                }
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs disabled:opacity-50 shadow-sm"
              >
                {updating ? "Logging..." : "Confirm & Start Break"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
