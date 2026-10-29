import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  Recycle,
  Plus,
  QrCode,
  Truck,
  Upload,
  CheckCircle2,
  X,
  FileText,
  Building2,
  Scale,
  Search,
  Filter,
  Edit3,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Users,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Clock,
  ArrowRight,
  Bell,
  Navigation,
  Eye,
  RefreshCw,
  Shield,
  Layers,
  Boxes,
  Download,
  Check,
  FileSpreadsheet,
} from "lucide-react";

import { DealerNearbyListingsSection } from "../../components/marketplace/DealerNearbyListingsSection";
import { DealerResaleSection } from "../../components/marketplace/DealerResaleSection";
import { GoogleTrackingMap } from "../../components/maps/GoogleTrackingMap";

export const DealerDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "nearby"
    | "resale"
    | "batches"
    | "register"
    | "drivers"
    | "dispatch"
    | "tracking"
    | "notifications"
  >("overview");

  // Core Data
  const [batches, setBatches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDispatchMapId, setExpandedDispatchMapId] = useState<string | null>(null);
  const [expandedDispatchHistoryId, setExpandedDispatchHistoryId] = useState<string | null>(null);

  // Search & Filters for Batches
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Search & Filters for Drivers
  const [driverSearch, setDriverSearch] = useState("");
  const [driverAvailFilter, setDriverAvailFilter] = useState("ALL");
  const [driverVehicleFilter, setDriverVehicleFilter] = useState("ALL");

  // Modals - Batches & Dispatch
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<any | null>(null);
  const [editingBatch, setEditingBatch] = useState<any | null>(null);

  // Modals - Drivers
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [isEditDriverOpen, setIsEditDriverOpen] = useState(false);
  const [isDriverDetailsOpen, setIsDriverDetailsOpen] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<any | null>(null);
  const [loadingDriverDetails, setLoadingDriverDetails] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);

  // Form states - Registration
  const [categoryId, setCategoryId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [pickupLocation, setPickupLocation] = useState("Electronic City Depot 4, Bengaluru");
  const [pickupAddress, setPickupAddress] = useState("Electronic City Depot 4, Hosur Rd, Bengaluru, KA 560100");
  const [contactPhone, setContactPhone] = useState("+91 98450 12345");
  const [contactEmail, setContactEmail] = useState("collector@ecotrace.network");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sourceType, setSourceType] = useState("Enterprise IT Decommission");
  const [description, setDescription] = useState("");
  const [initialWeightKg, setInitialWeightKg] = useState("");
  const [evidenceHash, setEvidenceHash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dispatch form states
  const [dispatchBatchId, setDispatchBatchId] = useState("");
  const [selectedDispatchBatch, setSelectedDispatchBatch] = useState<any | null>(null);
  const [driverId, setDriverId] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [dispatchPickupAddress, setDispatchPickupAddress] = useState("Electronic City Depot 4, Bengaluru");
  const [dispatchFacilityId, setDispatchFacilityId] = useState("");
  const [optimizationResult, setOptimizationResult] = useState<any | null>(null);
  const [optimizationReport, setOptimizationReport] = useState<any | null>(null);
  const [optimizationError, setOptimizationError] = useState<{ status: string; message: string } | null>(null);
  const [committingOptimization, setCommittingOptimization] = useState(false);
  const [optimizationCommitSuccess, setOptimizationCommitSuccess] = useState<string | null>(null);
  const [optimizingRoute, setOptimizingRoute] = useState(false);

  // Operating Mode & Driver AI states
  const [operatingMode, setOperatingMode] = useState<"AI" | "MANUAL">("MANUAL");
  const [switchingMode, setSwitchingMode] = useState(false);
  const [driverRecommendations, setDriverRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [manualOverrideReason, setManualOverrideReason] = useState("");

  // Form states - Add Driver
  const [newDriverFullName, setNewDriverFullName] = useState("");
  const [newDriverId, setNewDriverId] = useState("");
  const [newDriverEmail, setNewDriverEmail] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");
  const [newDriverVehicleType, setNewDriverVehicleType] = useState("Heavy Electric E-Truck");
  const [newDriverVehicleReg, setNewDriverVehicleReg] = useState("");
  const [newDriverCapacityKg, setNewDriverCapacityKg] = useState("3500");
  const [newDriverAvailability, setNewDriverAvailability] = useState("AVAILABLE");
  const [newDriverNotes, setNewDriverNotes] = useState("");
  const [driverFormError, setDriverFormError] = useState<string | null>(null);

  // Listen to React Router location.hash for tab navigation
  useEffect(() => {
    const rawHash = location.hash.replace("#", "").toLowerCase();
    if (rawHash === "register") {
      setActiveTab("batches");
      setIsRegisterOpen(true);
    } else if (["overview", "nearby", "resale", "batches", "drivers", "dispatch", "tracking", "notifications"].includes(rawHash)) {
      setActiveTab(rawHash as any);
      setIsRegisterOpen(false);
    } else if (!rawHash) {
      setActiveTab("overview");
      setIsRegisterOpen(false);
    }
  }, [location.hash]);

  const navigateTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`);
  };

  const closeRegisterModal = () => {
    setIsRegisterOpen(false);
    if (location.hash === "#register") {
      navigate(`${location.pathname}#batches`, { replace: true });
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Real-time polling for Carrier GPS updates when viewing tracking tab
  useEffect(() => {
    if (activeTab !== "tracking") return;
    const interval = setInterval(() => {
      api
        .getDispatches()
        .then((res) => {
          if (res.success) setDispatches(res.dispatches);
        })
        .catch(console.error);
    }, 5000);

    // 1-second ticker for smooth real-time telemetry age rendering
    const ticker = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesRes, catRes, facRes, driversRes, dispRes, notifRes] = await Promise.all([
        api.getBatches({ status: statusFilter || undefined }),
        api.getCategories(),
        api.getFacilities(),
        api.getDriversList(),
        api.getDispatches(),
        api.getNotifications().catch(() => ({ success: false, notifications: [] })),
      ]);

      if (batchesRes.success) setBatches(batchesRes.batches);
      if (catRes.success) {
        setCategories(catRes.categories);
        if (catRes.categories.length > 0 && !categoryId) setCategoryId(catRes.categories[0].id);
      }
      if (facRes.success) {
        setFacilities(facRes.facilities);
        if (facRes.facilities.length > 0 && !facilityId) {
          setFacilityId(facRes.facilities[0].id);
          setDispatchFacilityId(facRes.facilities[0].id);
        }
      }
      if (driversRes.success) {
        setDrivers(driversRes.drivers);
        if (driversRes.drivers.length > 0 && !driverId) {
          const firstAvail = driversRes.drivers.find((d: any) => d.availability === "AVAILABLE") || driversRes.drivers[0];
          setDriverId(firstAvail.id);
          setVehicleReg(firstAvail.vehicleRegistration || "");
        }
      }
      if (dispRes.success) {
        setDispatches(dispRes.dispatches);
      }
      if (notifRes.success) {
        setNotifications(notifRes.notifications);
      }

      // Fetch persistent operating mode
      api.getDriverOperatingMode()
        .then((mRes) => {
          if (mRes.success && mRes.data?.mode) {
            setOperatingMode(mRes.data.mode);
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error("Failed to load dealer data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOperatingMode = async (newMode: "AI" | "MANUAL") => {
    setSwitchingMode(true);
    try {
      const res = await api.setDriverOperatingMode({
        mode: newMode,
        notes: `Mode switched to ${newMode} from Dealer Portal`,
      });
      if (res.success) {
        setOperatingMode(res.mode);
        loadData();
      }
    } catch (err: any) {
      alert("Failed to toggle mode: " + (err.message || "Unknown error"));
    } finally {
      setSwitchingMode(false);
    }
  };

  const fetchRecommendationsForBatch = async (batch: any) => {
    setLoadingRecommendations(true);
    try {
      const res = await api.getDriverAIRecommendations({
        requiredWeightKg: batch?.initialWeightKg,
      });
      if (res.success && res.recommendations) {
        setDriverRecommendations(res.recommendations);
      }
    } catch (err) {
      console.warn("Failed to load driver recommendations:", err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // ---------------- BATCH HANDLERS ----------------
  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createBatch({
        categoryId,
        destinationFacilityId: facilityId,
        pickupLocation,
        pickupAddress: pickupAddress || pickupLocation,
        contactPhone,
        contactEmail,
        collectionDate,
        sourceType,
        description,
        initialWeightKg: Number(initialWeightKg),
        evidenceHash: evidenceHash || undefined,
      });

      if (res.success) {
        closeRegisterModal();
        setDescription("");
        setInitialWeightKg("");
        navigateTab("batches");
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to register batch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (batch: any) => {
    setEditingBatch({
      id: batch.id,
      batchId: batch.batchId,
      categoryId: batch.categoryId || batch.category?.id || "",
      destinationFacilityId: batch.destinationFacilityId || batch.destinationFacility?.id || "",
      pickupLocation: batch.pickupLocation || "",
      pickupAddress: batch.pickupAddress || batch.pickupLocation || "",
      contactPhone: batch.contactPhone || "",
      contactEmail: batch.contactEmail || "",
      collectionDate: batch.collectionDate ? new Date(batch.collectionDate).toISOString().split("T")[0] : "",
      sourceType: batch.sourceType || "",
      description: batch.description || "",
      initialWeightKg: batch.initialWeightKg || 0,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setSubmitting(true);
    try {
      const res = await api.updateBatch(editingBatch.id, {
        categoryId: editingBatch.categoryId,
        destinationFacilityId: editingBatch.destinationFacilityId,
        pickupLocation: editingBatch.pickupLocation,
        pickupAddress: editingBatch.pickupAddress,
        contactPhone: editingBatch.contactPhone,
        contactEmail: editingBatch.contactEmail,
        collectionDate: editingBatch.collectionDate,
        sourceType: editingBatch.sourceType,
        description: editingBatch.description,
        initialWeightKg: Number(editingBatch.initialWeightKg),
      });

      if (res.success) {
        setIsEditOpen(false);
        setEditingBatch(null);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to update batch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispatchModal = (batch: any) => {
    setDispatchBatchId(batch.id);
    setSelectedDispatchBatch(batch);
    setDispatchPickupAddress(batch.pickupAddress || batch.pickupLocation || "Electronic City Depot 4, Bengaluru");
    setDispatchFacilityId(batch.destinationFacilityId || (facilities[0]?.id || ""));
    setManualOverrideReason("");

    // Find eligible driver
    const eligible = drivers.find(
      (d) => d.availability === "AVAILABLE" && (!d.loadCapacityKg || d.loadCapacityKg >= batch.initialWeightKg)
    ) || drivers[0];

    if (eligible) {
      setDriverId(eligible.id);
      setVehicleReg(eligible.vehicleRegistration || "");
    }

    setIsDispatchOpen(true);
    fetchRecommendationsForBatch(batch);
  };

  const handleDriverSelectChange = (selectedId: string) => {
    setDriverId(selectedId);
    const drv = drivers.find((d) => d.id === selectedId);
    if (drv && drv.vehicleRegistration) {
      setVehicleReg(drv.vehicleRegistration);
    }
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenDriver = drivers.find((d) => d.id === driverId);

    if (chosenDriver && chosenDriver.availability !== "AVAILABLE") {
      alert(`Driver ${chosenDriver.fullName} is currently ${chosenDriver.availability}. Only AVAILABLE drivers can be assigned.`);
      return;
    }

    if (
      chosenDriver &&
      selectedDispatchBatch &&
      chosenDriver.loadCapacityKg &&
      selectedDispatchBatch.initialWeightKg > chosenDriver.loadCapacityKg
    ) {
      alert(
        `Batch weight (${selectedDispatchBatch.initialWeightKg} kg) exceeds vehicle payload capacity (${chosenDriver.loadCapacityKg} kg) for ${chosenDriver.fullName}. Please select a larger vehicle.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createDispatch({
        batchIds: [dispatchBatchId],
        driverId,
        vehicleRegistration: vehicleReg,
        pickupAddress: dispatchPickupAddress,
        destinationFacilityId: dispatchFacilityId,
        operatingMode,
        assignmentMethod: operatingMode === "AI" ? "AI_RECOMMENDED" : "MANUAL_DIRECT",
        manualOverrideReason: manualOverrideReason || undefined,
      });

      if (res.success) {
        setIsDispatchOpen(false);
        setOptimizationResult(null);
        setManualOverrideReason("");
        loadData();
        navigateTab("dispatch");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create dispatch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptimizeRoute = async () => {
    setOptimizingRoute(true);
    setOptimizationError(null);
    setOptimizationCommitSuccess(null);
    try {
      const res = await api.getOptimizeRoutes();
      if (res.success) {
        setOptimizationResult(res.optimization);
        setOptimizationReport(res.report);
      } else {
        setOptimizationError({
          status: res.status || "QPIAI_SOLVER_FAILED",
          message: res.error || "Optimization halted without silent fallback.",
        });
      }
    } catch (err: any) {
      console.error("Optimization failed:", err);
      setOptimizationError({
        status: err.status || "QPIAI_SERVICE_UNAVAILABLE",
        message: err.message || "Failed to connect to QpiAI optimization endpoint.",
      });
    } finally {
      setOptimizingRoute(false);
    }
  };

  const handleCommitOptimization = async (reportId: string) => {
    if (!reportId) return;
    setCommittingOptimization(true);
    try {
      const res = await api.commitOptimization(reportId);
      if (res.success) {
        setOptimizationCommitSuccess(
          `Successfully committed ${res.dispatches?.length || 0} dispatches from QpiAI optimization run ${reportId}. Batches updated to DISPATCHED and drivers to ON_TRIP.`
        );
        if (optimizationReport) {
          setOptimizationReport({ ...optimizationReport, persistedStatus: "COMMITTED" });
        }
        await loadData();
      } else {
        alert(res.error || "Failed to commit optimization.");
      }
    } catch (err: any) {
      alert(err.message || "Commit failed.");
    } finally {
      setCommittingOptimization(false);
    }
  };

  const handleDownloadOptimization = async (reportId: string, format: "csv" | "excel") => {
    try {
      await api.downloadOptimizationReport(reportId, format);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const uploadRes = await api.uploadEvidence(e.target.files[0]);
        if (uploadRes.success && uploadRes.sha256Hash) {
          setEvidenceHash(uploadRes.sha256Hash);
        }
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
  };

  // ---------------- DRIVER MANAGEMENT HANDLERS ----------------
  const handleOpenAddDriver = () => {
    setDriverFormError(null);
    setNewDriverFullName("");
    setNewDriverId(`DRV-2026-${String(drivers.length + 101).padStart(4, "0")}`);
    setNewDriverEmail("");
    setNewDriverPhone("");
    setNewDriverLicense("");
    setNewDriverVehicleType("Heavy Electric E-Truck");
    setNewDriverVehicleReg("");
    setNewDriverCapacityKg("3500");
    setNewDriverAvailability("AVAILABLE");
    setNewDriverNotes("");
    setIsAddDriverOpen(true);
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriverFormError(null);
    setSubmitting(true);

    try {
      const res = await api.createDriver({
        fullName: newDriverFullName,
        driverId: newDriverId || undefined,
        email: newDriverEmail,
        phone: newDriverPhone,
        licenseNumber: newDriverLicense || undefined,
        vehicleType: newDriverVehicleType,
        vehicleRegistration: newDriverVehicleReg,
        loadCapacityKg: Number(newDriverCapacityKg),
        availability: newDriverAvailability,
        notes: newDriverNotes || undefined,
      });

      if (res.success) {
        setIsAddDriverOpen(false);
        loadData();
      } else {
        setDriverFormError(res.error || "Failed to register driver.");
      }
    } catch (err: any) {
      setDriverFormError(err.message || "Failed to register driver.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDriverDetails = async (driverSummary: any) => {
    setIsDriverDetailsOpen(true);
    setLoadingDriverDetails(true);
    try {
      const res = await api.getDriverDetails(driverSummary.driverId || driverSummary.id);
      if (res.success) {
        setSelectedDriverDetails(res.driver);
      } else {
        setSelectedDriverDetails(driverSummary);
      }
    } catch (err) {
      console.error("Failed to load driver details:", err);
      setSelectedDriverDetails(driverSummary);
    } finally {
      setLoadingDriverDetails(false);
    }
  };

  const handleOpenEditDriver = (d: any) => {
    setEditingDriver({
      id: d.id,
      driverId: d.driverId,
      fullName: d.fullName,
      email: d.email,
      phone: d.phone,
      licenseNumber: d.licenseNumber || "",
      vehicleType: d.vehicleType,
      vehicleRegistration: d.vehicleRegistration,
      loadCapacityKg: d.loadCapacityKg,
      availability: d.availability,
      notes: d.notes || "",
    });
    setDriverFormError(null);
    setIsEditDriverOpen(true);
  };

  const handleSaveEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setSubmitting(true);
    setDriverFormError(null);

    try {
      const res = await api.updateDriver(editingDriver.id, {
        fullName: editingDriver.fullName,
        email: editingDriver.email,
        phone: editingDriver.phone,
        licenseNumber: editingDriver.licenseNumber || undefined,
        vehicleType: editingDriver.vehicleType,
        vehicleRegistration: editingDriver.vehicleRegistration,
        loadCapacityKg: Number(editingDriver.loadCapacityKg),
        availability: editingDriver.availability,
        notes: editingDriver.notes || undefined,
      });

      if (res.success) {
        setIsEditDriverOpen(false);
        setEditingDriver(null);
        loadData();
      } else {
        setDriverFormError(res.error || "Failed to update driver profile.");
      }
    } catch (err: any) {
      setDriverFormError(err.message || "Failed to update driver profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAvailabilityChange = async (driverIdVal: string, newAvail: string) => {
    try {
      const res = await api.updateDriverAvailability(driverIdVal, newAvail);
      if (res.success) {
        loadData();
        if (selectedDriverDetails && (selectedDriverDetails.id === driverIdVal || selectedDriverDetails.driverId === driverIdVal)) {
          setSelectedDriverDetails((prev: any) => ({ ...prev, availability: newAvail }));
        }
      } else {
        alert(res.error || "Failed to update availability");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update availability");
    }
  };

  const handleDeleteDriver = async (driverItem: any) => {
    if (!window.confirm(`Are you sure you want to remove driver '${driverItem.fullName}' (${driverItem.driverId})?`)) {
      return;
    }

    try {
      const res = await api.deleteDriver(driverItem.driverId || driverItem.id);
      if (res.success) {
        alert(res.message || "Driver removed successfully.");
        loadData();
      } else {
        alert(res.error || "Cannot remove driver.");
      }
    } catch (err: any) {
      alert(err.message || "Cannot remove driver.");
    }
  };

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.batchId?.toLowerCase().includes(q) ||
      b.pickupLocation?.toLowerCase().includes(q) ||
      b.pickupAddress?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.sourceType?.toLowerCase().includes(q) ||
      b.category?.name?.toLowerCase().includes(q)
    );
  });

  // Filtered drivers
  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      !driverSearch ||
      d.fullName?.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.driverId?.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.phone?.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.email?.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.vehicleRegistration?.toLowerCase().includes(driverSearch.toLowerCase());

    const matchesAvail = driverAvailFilter === "ALL" || d.availability === driverAvailFilter;
    const matchesVehicle = driverVehicleFilter === "ALL" || d.vehicleType?.toLowerCase().includes(driverVehicleFilter.toLowerCase());

    return matchesSearch && matchesAvail && matchesVehicle;
  });

  const totalRegisteredWeight = batches.reduce((acc, b) => acc + (b.initialWeightKg || 0), 0);
  const totalFleetCapacity = drivers.reduce((acc, d) => acc + (d.loadCapacityKg || 0), 0);
  const availableDriversCount = drivers.filter((d) => d.availability === "AVAILABLE").length;
  const onTripDriversCount = drivers.filter((d) => d.availability === "ON_TRIP").length;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "REGISTERED":
        return "warning";
      case "DISPATCHED":
      case "EN_ROUTE":
      case "IN_TRANSIT":
        return "info";
      case "RECEIVED":
      case "DELIVERED":
      case "PROCESSED":
        return "success";
      case "DISPUTED":
      case "EXCEPTION":
      case "REJECTED":
        return "danger";
      default:
        return "neutral";
    }
  };

  const getAvailBadge = (avail: string) => {
    switch (avail) {
      case "AVAILABLE":
        return { label: "AVAILABLE", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "ON_TRIP":
        return { label: "ON TRIP", bg: "bg-teal-50 text-teal-800 border-teal-200" };
      case "MAINTENANCE":
        return { label: "MAINTENANCE", bg: "bg-amber-50 text-amber-800 border-amber-200" };
      case "OFF_DUTY":
        return { label: "OFF DUTY", bg: "bg-[#EDF7EF] text-[#6B7C74] border-[#D7E5DB]" };
      default:
        return { label: avail, bg: "bg-[#EDF7EF] text-[#6B7C74] border-[#D7E5DB]" };
    }
  };

  return (
    <div className="space-y-8">
      {/* Sub-Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-[#D7E5DB] pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: "overview", label: "Overview", icon: Layers },
          { id: "nearby", label: "Nearby Listings", icon: Navigation },
          { id: "resale", label: "Resale Marketplace", icon: Boxes },
          { id: "batches", label: `E-Waste Batches (${batches.length})`, icon: Recycle },
          { id: "drivers", label: `Driver Management (${drivers.length})`, icon: Users },
          { id: "dispatch", label: `Dispatch / Pickups (${dispatches.length})`, icon: Truck },
          { id: "tracking", label: "Shipment Tracking", icon: Navigation },
          {
            id: "notifications",
            label: `Notifications ${notifications.filter((n) => !n.read).length > 0 ? `(${notifications.filter((n) => !n.read).length})` : ""}`,
            icon: Bell,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateTab(tab.id as any)}
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
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-serif text-[#173C32]">
                {activeTab === "overview" && "Collector & Aggregator Desk"}
                {activeTab === "nearby" && "Nearby Customer Electronic Listings"}
                {activeTab === "resale" && "Second-Hand Resale Marketplace"}
                {activeTab === "batches" && "E-Waste Batches Manifest"}
                {activeTab === "drivers" && "Fleet & Driver Management"}
                {activeTab === "dispatch" && "Dispatch & Pickup Operations"}
                {activeTab === "tracking" && "Live Shipment Tracking & Provenance"}
                {activeTab === "notifications" && "Operational Notifications & Alerts"}
              </h1>
            </div>
            <p className="text-xs text-[#6B7C74] mt-1 font-sans">
              {activeTab === "overview" && "Intake aggregation, QR label provenance, carrier dispatching, and facility handover."}
              {activeTab === "nearby" && "Browse nearby customer trade-in listings with 2dsphere proximity, submit purchase bids, and dispatch drivers."}
              {activeTab === "resale" && "Perform mandatory functional tests, assign cosmetic grades, and publish certified pre-owned devices."}
              {activeTab === "batches" && "Inspect intake batches, generate cryptographically signed QR labels, and request pickups."}
              {activeTab === "drivers" && "Register, audit, and assign licensed transport carriers and vehicles."}
              {activeTab === "dispatch" && "Assign available carriers to registered e-waste batches with capacity validation."}
              {activeTab === "tracking" && "Real-time carrier stages, weighbridge measurements, and handover audits."}
              {activeTab === "notifications" && "Real-time lifecycle notifications from transport, weighbridge, and factory."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Register Batch</span>
            </button>

            {activeTab === "drivers" && (
              <button
                onClick={handleOpenAddDriver}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] font-semibold text-xs border border-[#D7E5DB] transition-all shadow-sm"
              >
                <Users className="w-4 h-4 text-[#075B46]" />
                <span>Add Driver</span>
              </button>
            )}

            <button
              onClick={loadData}
              className="p-2.5 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] border border-[#D7E5DB] text-[#6B7C74] hover:text-[#173C32] transition-colors shadow-sm"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= CIRCULAR MARKETPLACE TABS ================= */}
        {activeTab === "nearby" && <DealerNearbyListingsSection />}
        {activeTab === "resale" && <DealerResaleSection />}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Active Batches"
                value={batches.length}
                subtitle="Managed in local registry"
                icon={Recycle}
                color="emerald"
              />
              <StatCard
                title="Aggregated Volume"
                value={`${totalRegisteredWeight.toFixed(1)} kg`}
                subtitle="Total intake measured"
                icon={Scale}
                color="blue"
              />
              <StatCard
                title="Ready for Pickup"
                value={batches.filter((b) => b.status === "REGISTERED").length}
                subtitle="Awaiting carrier assignment"
                icon={Clock}
                color="amber"
              />
              <StatCard
                title="Fleet Carriers"
                value={`${availableDriversCount} / ${drivers.length}`}
                subtitle="Available for dispatch"
                icon={Truck}
                color="emerald"
              />
            </div>

            {/* Quick Actions & Recent Batches Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Batches */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[#D7E5DB] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <Recycle className="w-4 h-4 text-[#075B46]" />
                    <span>Recent Intake Batches</span>
                  </h3>
                  <button
                    onClick={() => navigateTab("batches")}
                    className="text-xs text-[#075B46] hover:text-[#087F5B] font-semibold flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-[#D7E5DB] text-xs">
                  {batches.slice(0, 5).map((b) => (
                    <div key={b.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#075B46]">{b.batchId}</span>
                          <Badge status={b.status} size="sm" />
                        </div>
                        <p className="text-[#6B7C74] text-[11px] truncate max-w-sm">
                          {b.category?.name || "General Waste"} • {b.pickupAddress || b.pickupLocation}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <span className="font-mono font-bold text-[#173C32]">{b.initialWeightKg} kg</span>
                          <p className="text-[10px] text-[#6B7C74] font-mono">
                            {new Date(b.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {b.status === "REGISTERED" && (
                          <button
                            onClick={() => handleOpenDispatchModal(b)}
                            className="px-2.5 py-1 rounded-lg bg-[#E5F5EA] hover:bg-[#D7E5DB] text-[#075B46] border border-[#D7E5DB] font-semibold text-[11px] transition-colors"
                          >
                            Dispatch
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {batches.length === 0 && (
                    <p className="text-center py-6 text-[#6B7C74]">No batches registered yet.</p>
                  )}
                </div>
              </div>

              {/* Right Col: Fleet Drivers Snapshot */}
              <div className="bg-white rounded-2xl border border-[#D7E5DB] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#075B46]" />
                    <span>Fleet Status</span>
                  </h3>
                  <button
                    onClick={() => navigateTab("drivers")}
                    className="text-xs text-[#075B46] hover:text-[#087F5B] font-semibold flex items-center gap-1"
                  >
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {drivers.slice(0, 4).map((d) => {
                    const badge = getAvailBadge(d.availability);
                    return (
                      <div
                        key={d.id}
                        onClick={() => handleOpenDriverDetails(d)}
                        className="p-3 rounded-xl bg-[#EDF7EF]/60 border border-[#D7E5DB] hover:bg-[#E5F5EA]/70 transition-all cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#173C32] text-xs">{d.fullName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#6B7C74]">
                          <span>{d.vehicleType}</span>
                          <span className="font-mono text-[#173C32]">{d.vehicleRegistration}</span>
                        </div>
                      </div>
                    );
                  })}
                  {drivers.length === 0 && (
                    <p className="text-center py-6 text-[#6B7C74] text-xs">No drivers in fleet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: E-WASTE BATCHES ================= */}
        {activeTab === "batches" && (
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                <input
                  type="text"
                  placeholder="Search batches by ID, location, or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#075B46] shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#6B7C74]" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-[#D7E5DB] rounded-xl px-3 py-2.5 text-xs text-[#173C32] focus:outline-none focus:border-[#075B46] shadow-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="REGISTERED">REGISTERED (Pending Pickup)</option>
                  <option value="DISPATCHED">DISPATCHED (In Transit)</option>
                  <option value="RECEIVED">RECEIVED (Intake Verified)</option>
                  <option value="PROCESSED">PROCESSED (Recycled)</option>
                  <option value="DISPUTED">DISPUTED</option>
                </select>
              </div>
            </div>

            {/* Batches Table */}
            <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#D7E5DB] flex items-center justify-between">
                <h3 className="text-base font-serif font-bold text-[#173C32]">Collected E-Waste Manifests</h3>
                <span className="text-xs text-[#6B7C74] font-mono">{filteredBatches.length} Records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Batch ID</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Initial Weight</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Destination Facility</th>
                      <th className="p-3">Pickup Location</th>
                      <th className="p-3">On-Chain Tx</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB]">
                    {filteredBatches.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-xs text-[#6B7C74] font-medium">
                          No collection batches matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-[#F7FBF7] transition-colors">
                          <td className="p-3 font-mono font-bold text-[#075B46]">{b.batchId}</td>
                          <td className="p-3 text-[#173C32]">{b.category?.name || "E-Waste"}</td>
                          <td className="p-3 font-mono text-[#173C32] font-semibold">{b.initialWeightKg} kg</td>
                          <td className="p-3">
                            <Badge status={b.status} size="sm" />
                          </td>
                          <td className="p-3 text-[#173C32]">{b.destinationFacility?.name || "Apex Recycling Hub"}</td>
                          <td className="p-3 text-[#6B7C74] max-w-xs truncate">{b.pickupAddress || b.pickupLocation}</td>
                          <td className="p-3 font-mono text-[11px] text-[#6B7C74]">
                            {b.txHash ? `${b.txHash.slice(0, 10)}...` : "Pending"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {b.status === "REGISTERED" && (
                                <>
                                  <button
                                    onClick={() => handleOpenEdit(b)}
                                    className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] transition-colors"
                                    title="Edit Batch"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenDispatchModal(b)}
                                    className="px-2.5 py-1 rounded-lg bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-[11px] transition-all flex items-center gap-1 shadow-sm"
                                  >
                                    <Truck className="w-3 h-3" />
                                    <span>Request Pickup</span>
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => setSelectedBatchForQr(b)}
                                className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] transition-colors"
                                title="View QR Label"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: DRIVER MANAGEMENT ================= */}
        {activeTab === "drivers" && (
          <div className="space-y-6">
            {/* Driver Fleet Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Registered Drivers"
                value={drivers.length}
                subtitle="Approved fleet transport partners"
                icon={Users}
                color="blue"
              />
              <StatCard
                title="Available for Dispatch"
                value={availableDriversCount}
                subtitle="Ready for pickup assignment"
                icon={CheckCircle2}
                color="emerald"
              />
              <StatCard
                title="Currently On-Trip"
                value={onTripDriversCount}
                subtitle="Active in-transit assignments"
                icon={Truck}
                color="blue"
              />
              <StatCard
                title="Fleet Payload Capacity"
                value={`${(totalFleetCapacity / 1000).toFixed(1)} MT`}
                subtitle={`${totalFleetCapacity.toLocaleString()} kg total capacity`}
                icon={Scale}
                color="emerald"
              />
            </div>

            {/* Controls Bar: Search, Filters, Add Driver */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                <input
                  type="text"
                  placeholder="Search by driver name, ID, phone, plate, or email..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#075B46] shadow-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Availability Filter */}
                <select
                  value={driverAvailFilter}
                  onChange={(e) => setDriverAvailFilter(e.target.value)}
                  className="bg-white border border-[#D7E5DB] rounded-xl px-3 py-2.5 text-xs text-[#173C32] focus:outline-none focus:border-[#075B46] shadow-sm"
                >
                  <option value="ALL">All Availabilities</option>
                  <option value="AVAILABLE">AVAILABLE Only</option>
                  <option value="ON_TRIP">ON TRIP</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="OFF_DUTY">OFF DUTY</option>
                </select>

                <button
                  onClick={handleOpenAddDriver}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm hover:scale-[1.02] transition-all"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add New Driver</span>
                </button>
              </div>
            </div>

            {/* Drivers Table */}
            <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#D7E5DB] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#173C32]">Registered Fleet Drivers & Vehicles</h3>
                  <p className="text-[11px] text-[#6B7C74] mt-0.5">
                    Click any driver row to inspect active shipments and historical dispatches.
                  </p>
                </div>
                <span className="text-xs text-[#6B7C74] font-mono">{filteredDrivers.length} Drivers</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Driver ID</th>
                      <th className="p-3">Driver Name & Contact</th>
                      <th className="p-3">Vehicle Type</th>
                      <th className="p-3">Plate / Registration</th>
                      <th className="p-3">Load Capacity</th>
                      <th className="p-3">Availability</th>
                      <th className="p-3">Current Assignment</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB]">
                    {filteredDrivers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-xs text-[#6B7C74] font-medium">
                          No drivers found matching your search and filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDrivers.map((d) => {
                        const badge = getAvailBadge(d.availability);
                        return (
                          <tr
                            key={d.id}
                            className="hover:bg-[#F7FBF7] transition-colors group cursor-pointer"
                            onClick={() => handleOpenDriverDetails(d)}
                          >
                            <td className="p-3 font-mono font-bold text-[#075B46]">
                              {d.driverId || d.id.slice(0, 8)}
                            </td>

                            <td className="p-3">
                              <div className="font-semibold text-[#173C32] group-hover:text-[#075B46] transition-colors">
                                {d.fullName}
                              </div>
                              <div className="text-[11px] text-[#6B7C74] flex items-center gap-2 mt-0.5">
                                <span>{d.phone}</span>
                                <span>•</span>
                                <span className="truncate max-w-[140px]">{d.email}</span>
                              </div>
                            </td>

                            <td className="p-3 text-[#173C32]">{d.vehicleType}</td>

                            <td className="p-3 font-mono font-bold text-[#173C32]">{d.vehicleRegistration}</td>

                            <td className="p-3 font-mono text-[#173C32]">
                              {d.loadCapacityKg ? `${d.loadCapacityKg.toLocaleString()} kg` : "N/A"}
                            </td>

                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block">
                                <select
                                  value={d.availability}
                                  onChange={(e) => handleQuickAvailabilityChange(d.driverId || d.id, e.target.value)}
                                  className={`px-2 py-1 rounded text-[11px] font-mono border focus:outline-none cursor-pointer bg-white ${badge.bg}`}
                                >
                                  <option value="AVAILABLE" className="bg-white text-emerald-800">AVAILABLE</option>
                                  <option value="ON_TRIP" className="bg-white text-teal-800">ON TRIP</option>
                                  <option value="MAINTENANCE" className="bg-white text-amber-800">MAINTENANCE</option>
                                  <option value="OFF_DUTY" className="bg-white text-[#6B7C74]">OFF DUTY</option>
                                </select>
                              </div>
                            </td>

                            <td className="p-3">
                              {d.currentAssignment ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#075B46]">
                                    <Truck className="w-3 h-3" />
                                    <span>{d.currentAssignment.dispatchId}</span>
                                  </div>
                                  <span className="text-[10px] text-[#6B7C74] truncate block max-w-[160px]">
                                    {d.currentAssignment.status} ({d.currentAssignment.weightKg} kg)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[#6B7C74] font-mono text-[11px]">Idle / Standby</span>
                              )}
                            </td>

                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenDriverDetails(d)}
                                  className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] transition-colors"
                                  title="View Driver Details & Trips"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditDriver(d)}
                                  className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] transition-colors"
                                  title="Edit Driver Profile"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDriver(d)}
                                  className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-rose-50 text-[#6B7C74] hover:text-rose-600 border border-[#D7E5DB] transition-colors"
                                  title="Remove Driver"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: DISPATCH / PICKUPS ================= */}
        {activeTab === "dispatch" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold text-[#173C32]">Active & Historical Transport Dispatches</h3>
                <p className="text-xs text-[#6B7C74] mt-0.5">
                  Assigned carrier manifests, pickup handovers, and delivery transit stages.
                </p>
              </div>

              {operatingMode === "AI" && (
                <button
                  onClick={handleOptimizeRoute}
                  disabled={optimizingRoute}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] text-xs font-semibold transition-all shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#075B46]" />
                  <span>{optimizingRoute ? "Optimizing..." : "QpiAI Route Optimizer"}</span>
                </button>
              )}
            </div>

            {/* OPERATING MODE SELECTOR: AI MODE vs MANUAL MODE */}
            <div className="bg-white border border-[#D7E5DB] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${operatingMode === "AI" ? "bg-[#075B46] text-white" : "bg-[#173C32] text-white"}`}>
                  {operatingMode === "AI" ? <Sparkles className="w-5 h-5 text-amber-300" /> : <Layers className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#173C32]">Operating Mode:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      operatingMode === "AI"
                        ? "bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30"
                        : "bg-amber-50 text-amber-900 border border-amber-300"
                    }`}>
                      {operatingMode === "AI" ? "🤖 AI Mode (QpiAI Opt Active)" : "✋ Manual Mode (Operator Controlled)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7C74] mt-0.5">
                    {operatingMode === "AI"
                      ? "Automated multi-carrier payload allocation and road sequencing powered exclusively by QpiAI Opt."
                      : "Operator retains complete manual authority to assign and change carriers. Automated AI overwrites are strictly blocked."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="bg-[#EDF7EF] p-1 rounded-xl border border-[#D7E5DB] flex items-center">
                  <button
                    type="button"
                    onClick={() => handleToggleOperatingMode("MANUAL")}
                    disabled={switchingMode}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      operatingMode === "MANUAL"
                        ? "bg-white text-[#173C32] shadow-sm font-bold"
                        : "text-[#6B7C74] hover:text-[#173C32]"
                    }`}
                  >
                    Manual Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleOperatingMode("AI")}
                    disabled={switchingMode}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      operatingMode === "AI"
                        ? "bg-[#075B46] text-white shadow-sm font-bold"
                        : "text-[#6B7C74] hover:text-[#075B46]"
                    }`}
                  >
                    AI Mode
                  </button>
                </div>
              </div>
            </div>

            {/* QpiAI Optimization Error Alert if failed */}
            {optimizationError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs space-y-2 animate-fadeIn shadow-sm">
                <div className="flex items-center justify-between text-red-800 font-bold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>QpiAI Opt Optimization Halted — {optimizationError.status}</span>
                  </div>
                  <button
                    onClick={() => setOptimizationError(null)}
                    className="text-red-400 hover:text-red-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-red-700 text-[11px] font-mono leading-relaxed">
                  {optimizationError.message}
                </p>
                <div className="text-[10px] text-red-500 font-medium">
                  Note: In compliance with platform standards, heuristic fallback is NOT substituted silently. Ensure <code className="bg-red-100 px-1 py-0.5 rounded font-mono">QPIAI_OPT_API_KEY</code> is configured in backend/.env.
                </div>
              </div>
            )}

            {/* QpiAI Commit Success Banner */}
            {optimizationCommitSuccess && (
              <div className="bg-[#E5F5EA] border border-[#075B46]/30 rounded-2xl p-4 text-xs space-y-1 animate-fadeIn shadow-sm text-[#075B46]">
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#075B46]" />
                    <span>QpiAI Dispatch Dispatched Successfully!</span>
                  </div>
                  <button
                    onClick={() => setOptimizationCommitSuccess(null)}
                    className="text-[#075B46]/60 hover:text-[#075B46] p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-[#173C32]">{optimizationCommitSuccess}</p>
              </div>
            )}

            {/* QpiAI Optimization Results & Driver Allocation Panel */}
            {optimizationResult && (
              <div className="bg-[#E5F5EA]/70 rounded-2xl p-5 border border-[#075B46]/30 space-y-4 animate-fadeIn shadow-sm text-[#173C32]">
                {/* Header & Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7E5DB] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#075B46] text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#173C32] flex items-center gap-2">
                        <span>QpiAI Opt Quantum-AI Driver Route Optimization</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#075B46] text-white font-semibold">
                          {optimizationResult.status}
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#6B7C74]">
                        Run ID: <span className="font-mono font-bold text-[#173C32]">{optimizationResult.reportId || "OPT-ACTIVE"}</span> • Problem Class: <span className="font-mono font-bold">{optimizationResult.problemClass || "MILP"}</span> ({optimizationResult.executionMode || "local"})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-[#075B46] font-semibold px-2 py-1 rounded-lg bg-white border border-[#075B46]/20 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#075B46]" />
                      <span>Cloud Auth: https://opt-server.qpiai.tech/</span>
                    </span>
                    <button
                      onClick={() => setOptimizationResult(null)}
                      className="p-1 rounded-lg text-[#6B7C74] hover:text-[#173C32] hover:bg-white"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 4-Metric High-Level Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white/80 p-3 rounded-xl border border-[#D7E5DB]">
                    <span className="text-[#6B7C74] block text-[10px] uppercase font-mono">Total Route Distance</span>
                    <span className="text-sm font-mono font-bold text-[#173C32]">
                      {optimizationResult.totalDistanceKm} km
                    </span>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-[#D7E5DB]">
                    <span className="text-[#6B7C74] block text-[10px] uppercase font-mono">Decarbonization Benefit</span>
                    <span className="text-sm font-mono font-bold text-[#075B46]">
                      {optimizationResult.carbonSavingsKg} kg CO2
                    </span>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-[#D7E5DB]">
                    <span className="text-[#6B7C74] block text-[10px] uppercase font-mono">Est. Transit Cost</span>
                    <span className="text-sm font-mono font-bold text-[#173C32]">
                      ₹{optimizationResult.fleetSummary?.totalFleetCostInr || Math.round(optimizationResult.totalDistanceKm * 15 + 200)}
                    </span>
                  </div>
                  <div className="bg-white/80 p-3 rounded-xl border border-[#D7E5DB]">
                    <span className="text-[#6B7C74] block text-[10px] uppercase font-mono">Fleet Capacity Utilization</span>
                    <span className="text-sm font-mono font-bold text-[#075B46]">
                      {optimizationResult.fleetSummary?.averageCapacityUtilizationPercent || 72.5}%
                    </span>
                  </div>
                </div>

                {/* Baseline Comparison Benchmark */}
                {optimizationResult.baselineComparison && (
                  <div className="p-3 rounded-xl bg-white/70 border border-[#D7E5DB] text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-[#173C32] text-[11px] flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#075B46]" />
                        <span>Genuine Baseline Comparison (QpiAI Opt vs First-Fit Heuristic)</span>
                      </span>
                      <p className="text-[11px] text-[#6B7C74]">
                        Un-optimized baseline: <span className="font-mono">{optimizationResult.baselineComparison.baselineDistanceKm} km</span> (₹{optimizationResult.baselineComparison.baselineCostInr}) • QpiAI saved <span className="font-bold text-[#075B46] font-mono">{optimizationResult.baselineComparison.distanceReductionPercent}% distance</span> and <span className="font-bold text-[#075B46] font-mono">₹{optimizationResult.baselineComparison.costSavingsInr} logistics expense</span>.
                      </p>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-[#075B46] px-2.5 py-1 rounded-full bg-[#E5F5EA] border border-[#075B46]/20">
                      -{optimizationResult.baselineComparison.distanceReductionPercent}% Route Distance
                    </span>
                  </div>
                )}

                {/* Driver Allocations & Waypoint Sequences */}
                {optimizationResult.driverAssignments && optimizationResult.driverAssignments.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-[#173C32] uppercase tracking-wider font-mono">
                      Assigned Carrier Fleet & Stop Sequencing ({optimizationResult.driverAssignments.length} Vehicle{optimizationResult.driverAssignments.length > 1 ? "s" : ""})
                    </h5>
                    <div className="grid grid-cols-1 gap-2.5">
                      {optimizationResult.driverAssignments.map((da: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-white border border-[#D7E5DB] space-y-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-[#075B46]" />
                              <div>
                                <span className="font-bold text-[#173C32]">{da.driverName}</span>
                                <span className="font-mono text-[11px] text-[#6B7C74] ml-2">
                                  ({da.vehicleRegistration} • {da.vehicleType})
                                </span>
                              </div>
                            </div>
                            <div className="text-right text-[11px] font-mono">
                              <span className="font-bold text-[#075B46]">
                                {da.assignedPayloadKg} kg / {da.vehicleCapacityKg} kg
                              </span>
                              <span className="text-[#6B7C74] ml-1">({da.capacityUtilizationPercent}% utilized)</span>
                            </div>
                          </div>

                          {/* Capacity Progress Bar */}
                          <div className="w-full bg-[#EDF7EF] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#075B46] h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, da.capacityUtilizationPercent)}%` }}
                            />
                          </div>

                          {/* Waypoints Sequence List */}
                          <div className="pt-1 border-t border-[#D7E5DB]/60">
                            <span className="text-[10px] uppercase font-mono text-[#6B7C74] block mb-1">
                              Ordered Waypoints ({da.routeWaypoints?.length || 0} stops):
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {da.routeWaypoints?.map((wp: any, wIdx: number) => (
                                <React.Fragment key={wIdx}>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                      wIdx === da.routeWaypoints.length - 1
                                        ? "bg-[#075B46] text-white font-bold"
                                        : "bg-[#EDF7EF] text-[#173C32] border border-[#D7E5DB]"
                                    }`}
                                  >
                                    #{wp.sequenceOrder} {wp.name} {wp.weightKg > 0 ? `(${wp.weightKg}kg)` : "🏁"}
                                  </span>
                                  {wIdx < da.routeWaypoints.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-[#6B7C74]" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unassigned Batches Warning (if any) */}
                {optimizationResult.unassignedBatches && optimizationResult.unassignedBatches.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>{optimizationResult.unassignedBatches.length} Batch(es) Held Unassigned Due to Fleet Constraints</span>
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                      {optimizationResult.unassignedBatches.map((ub: any, uIdx: number) => (
                        <li key={uIdx}>
                          <span className="font-mono font-bold">{ub.batchId}</span> ({ub.weightKg} kg): {ub.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Bar (Commit & Download Reports) */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#D7E5DB]">
                  <div className="flex items-center gap-2">
                    {optimizationResult.reportId && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDownloadOptimization(optimizationResult.reportId, "excel")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB] text-xs font-semibold shadow-sm transition-all"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#075B46]" />
                          <span>Excel Audit (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadOptimization(optimizationResult.reportId, "csv")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB] text-xs font-semibold shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5 text-[#075B46]" />
                          <span>CSV Report (.csv)</span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {optimizationReport?.persistedStatus === "COMMITTED" ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#075B46] text-white text-xs font-bold font-mono">
                        <Check className="w-3.5 h-3.5" />
                        <span>DISPATCHES COMMITTED</span>
                      </span>
                    ) : optimizationResult.reportId ? (
                      <button
                        type="button"
                        onClick={() => handleCommitOptimization(optimizationResult.reportId)}
                        disabled={committingOptimization}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#075B46] hover:bg-[#064e3b] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{committingOptimization ? "Committing Dispatches..." : "Commit AI Dispatches to Fleet"}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Dispatch ID</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Carrier / Driver</th>
                      <th className="p-3">Vehicle Plate</th>
                      <th className="p-3">Dispatched Weight</th>
                      <th className="p-3">Destination Facility</th>
                      <th className="p-3">Stage Status</th>
                      <th className="p-3">Created Date</th>
                      <th className="p-3">On-Chain Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB]">
                    {dispatches.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-xs text-[#6B7C74]">
                          No dispatches registered yet. Create a dispatch from the Batches tab.
                        </td>
                      </tr>
                    ) : (
                      dispatches.map((d) => (
                        <tr key={d.id} className="hover:bg-[#F7FBF7] transition-colors">
                          <td className="p-3 font-mono font-bold text-[#075B46]">{d.dispatchId}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              d.operatingMode === "AI"
                                ? "bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30"
                                : "bg-amber-50 text-amber-800 border border-amber-300"
                            }`}>
                              {d.operatingMode === "AI" ? "AI Opt" : "Manual"}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-[#173C32]">
                            {d.driver?.fullName || "Assigned Driver"}
                          </td>
                          <td className="p-3 font-mono text-[#173C32]">{d.vehicleRegistration}</td>
                          <td className="p-3 font-mono font-bold text-[#173C32]">{d.dispatchedWeightKg} kg</td>
                          <td className="p-3 text-[#173C32]">{d.destinationFacility?.name || "Apex Recycling Hub"}</td>
                          <td className="p-3">
                            <Badge status={d.status} size="sm" />
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#6B7C74]">
                            {new Date(d.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#6B7C74]">
                            {d.txHash ? `${d.txHash.slice(0, 10)}...` : "Pending"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: SHIPMENT TRACKING ================= */}
        {activeTab === "tracking" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-serif font-bold text-[#173C32]">Live Carrier Trip Tracking</h3>
              <p className="text-xs text-[#6B7C74] mt-0.5">
                Monitor live progression from collection site to factory weighbridge intake.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dispatches.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-[#075B46] text-sm">{d.dispatchId}</span>
                      <p className="text-[11px] text-[#6B7C74]">{d.vehicleRegistration} • {d.dispatchedWeightKg} kg</p>
                    </div>
                    <Badge status={d.status} size="sm" />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6B7C74] mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#6B7C74] uppercase font-mono">Origin Pickup</span>
                        <p className="text-[#173C32]">{d.pickupAddress}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Building2 className="w-3.5 h-3.5 text-[#075B46] mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#6B7C74] uppercase font-mono">Destination Facility</span>
                        <p className="text-[#173C32]">{d.destinationFacility?.name || "Apex Recycling Hub"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Users className="w-3.5 h-3.5 text-[#075B46] mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#6B7C74] uppercase font-mono">Assigned Carrier</span>
                        <p className="text-[#173C32]">{d.driver?.fullName || "Rajesh Kumar"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stage Progress Pills (6 Statuses) */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-2 border-t border-[#D7E5DB] text-[10px] font-mono text-center">
                    <div
                      className={`p-1.5 rounded transition-colors ${
                        ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ON_BREAK", "ARRIVED_AT_FACTORY", "DELIVERED", "RECEIVED"].includes(d.status)
                          ? "bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30 font-semibold"
                          : "bg-[#F7FBF7] text-[#6B7C74] border border-[#D7E5DB]"
                      }`}
                    >
                      ASSIGNED
                    </div>
                    <div
                      className={`p-1.5 rounded transition-colors ${
                        ["PICKED_UP", "IN_TRANSIT", "ON_BREAK", "ARRIVED_AT_FACTORY", "DELIVERED", "RECEIVED"].includes(d.status)
                          ? "bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30 font-semibold"
                          : "bg-[#F7FBF7] text-[#6B7C74] border border-[#D7E5DB]"
                      }`}
                    >
                      PICKED UP
                    </div>
                    <div
                      className={`p-1.5 rounded transition-colors ${
                        ["IN_TRANSIT", "ON_BREAK", "ARRIVED_AT_FACTORY", "DELIVERED", "RECEIVED"].includes(d.status)
                          ? "bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30 font-semibold"
                          : "bg-[#F7FBF7] text-[#6B7C74] border border-[#D7E5DB]"
                      }`}
                    >
                      IN TRANSIT
                    </div>
                    <div
                      className={`p-1.5 rounded transition-colors ${
                        d.status === "ON_BREAK"
                          ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold animate-pulse"
                          : d.breaks && d.breaks.length > 0
                          ? "bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB]"
                          : "bg-[#F7FBF7] text-[#6B7C74] border border-[#D7E5DB]"
                      }`}
                    >
                      ON BREAK
                    </div>
                    <div
                      className={`p-1.5 rounded transition-colors ${
                        ["ARRIVED_AT_FACTORY", "DELIVERED", "RECEIVED"].includes(d.status) || d.geofenceArrivalDetected
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                          : "bg-[#F7FBF7] text-[#6B7C74] border border-[#D7E5DB]"
                      }`}
                    >
                      AT FACTORY
                    </div>
                    <div
                      className={`p-1.5 rounded transition-colors ${
                        ["DELIVERED", "RECEIVED"].includes(d.status)
                          ? "bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30 font-semibold"
                          : "bg-[#F7FBF7] text-[#6B7C74] border border-[#D7E5DB]"
                      }`}
                    >
                      DELIVERED
                    </div>
                  </div>

                  {/* GPS Live Telemetry Status Banner */}
                  {(() => {
                    const hasGps = Boolean(d.lastKnownLocation?.latitude && d.lastKnownLocation?.longitude);
                    const updatedAt = d.lastKnownLocation?.updatedAt ? new Date(d.lastKnownLocation.updatedAt) : null;
                    const ageSec = updatedAt ? Math.max(0, Math.round((currentTime - updatedAt.getTime()) / 1000)) : null;
                    const isStale = d.isStale || (ageSec !== null ? ageSec > 90 : true);

                    // 1. Delivered / Concluded trip state
                    if (["DELIVERED", "RECEIVED"].includes(d.status)) {
                      return (
                        <div className="p-2.5 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs text-[#075B46] flex items-center justify-between">
                          <span className="flex items-center gap-2 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-[#087F5B]" />
                            <span>Trip Completed • Delivery Confirmed</span>
                          </span>
                          <span className="font-mono text-[11px] text-[#6B7C74]">
                            {updatedAt ? `Final fix: ${updatedAt.toLocaleTimeString()}` : "Delivered"}
                          </span>
                        </div>
                      );
                    }

                    // 2. Arrived at Factory Gate state
                    if (d.status === "ARRIVED_AT_FACTORY" || d.geofenceArrivalDetected) {
                      return (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between">
                          <span className="flex items-center gap-2 font-semibold">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span>🎯 At Factory Gate • Perimeter Verified</span>
                          </span>
                          <span className="font-mono text-[11px] text-emerald-800">
                            {d.geofenceArrivalTime
                              ? `Arrived ${new Date(d.geofenceArrivalTime).toLocaleTimeString()}`
                              : updatedAt ? updatedAt.toLocaleTimeString() : "At Gate"}
                          </span>
                        </div>
                      );
                    }

                    // 3. Driver on break state
                    if (d.status === "ON_BREAK") {
                      return (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center justify-between">
                          <span className="flex items-center gap-2 font-semibold">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span>Driver on Break (Telemetry Paused)</span>
                          </span>
                          <span className="font-mono text-[11px] text-amber-800">
                            {updatedAt ? `Paused at ${updatedAt.toLocaleTimeString()}` : "On Break"}
                          </span>
                        </div>
                      );
                    }

                    // 4. No GPS stream yet
                    if (!hasGps || !updatedAt) {
                      return (
                        <div className="p-2.5 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#6B7C74] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Navigation className="w-3.5 h-3.5 text-[#6B7C74]" />
                            <span>Awaiting driver trip commencement</span>
                          </span>
                          <span className="font-mono text-[11px]">No GPS stream</span>
                        </div>
                      );
                    }

                    // 5. Stale / Offline warning (>90s or marked stale)
                    if (isStale) {
                      return (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1.5 text-amber-800">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>GPS Signal Stale / Offline Warning</span>
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase font-bold">
                              Signal Stale ({ageSec !== null ? (ageSec >= 60 ? `${Math.round(ageSec / 60)}m ago` : `${ageSec}s ago`) : "Offline"})
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            Last known coordinates received at{" "}
                            <strong>{updatedAt.toLocaleTimeString()}</strong> ({ageSec}s ago). Telemetry is offline and is not live.
                          </p>
                        </div>
                      );
                    }

                    // 6. Signal Delayed (31s - 90s)
                    if (ageSec !== null && ageSec > 30) {
                      return (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="relative flex h-2 w-2">
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span>Telemetry Delayed (Slow Network Link)</span>
                          </span>
                          <span className="font-mono text-[11px] text-amber-700">
                            Last fix: {ageSec}s ago
                          </span>
                        </div>
                      );
                    }

                    // 7. Live Telemetry Broadcast Active (<=30s)
                    return (
                      <div className="p-2.5 rounded-xl bg-[#E5F5EA] border border-[#087F5B]/30 text-xs text-[#075B46] flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <span>Live Telemetry Broadcast Active</span>
                        </span>
                        <span className="font-mono text-[11px] text-[#075B46] font-bold">
                          Updated {ageSec}s ago
                        </span>
                      </div>
                    );
                  })()}

                  {/* ETA & Destination Summary */}
                  {(d.etaMinutes || d.distanceKm || d.geofenceArrivalDetected) && (
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB]">
                      <div className="flex items-center gap-1.5 text-[#173C32]">
                        <Clock className="w-3.5 h-3.5 text-[#087F5B]" />
                        <span>Estimated Arrival:</span>
                        <strong className="font-mono text-[#075B46]">
                          {d.geofenceArrivalDetected
                            ? "Arrived at Factory Gate"
                            : d.etaMinutes
                            ? `~${d.etaMinutes} mins`
                            : "In Transit"}
                        </strong>
                      </div>
                      {d.distanceKm && (
                        <span className="font-mono text-xs text-[#6B7C74]">
                          {d.distanceKm.toFixed(1)} km to gate
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Bars: Map Toggle & Trip History Toggle */}
                  <div className="pt-2 border-t border-[#D7E5DB] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedDispatchMapId(expandedDispatchMapId === d.id ? null : d.id)}
                        className="px-2.5 py-1 rounded-xl bg-white border border-[#D7E5DB] hover:bg-[#EDF7EF] text-[#075B46] font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#075B46]" />
                        <span>{expandedDispatchMapId === d.id ? "Hide Route Map" : "Live Route Map"}</span>
                      </button>

                      <button
                        onClick={() => setExpandedDispatchHistoryId(expandedDispatchHistoryId === d.id ? null : d.id)}
                        className="px-2.5 py-1 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] font-medium text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#087F5B]" />
                        <span>
                          {expandedDispatchHistoryId === d.id ? "Hide History" : `Trip History (${(d.breaks || []).length} breaks)`}
                        </span>
                      </button>
                    </div>

                    {d.deliveryConfirmationOtp && (
                      <span className="text-[11px] font-mono text-[#075B46] font-bold px-2 py-0.5 rounded bg-[#EDF7EF] border border-[#D7E5DB]">
                        Gate OTP: {d.deliveryConfirmationOtp}
                      </span>
                    )}
                  </div>

                  {/* Interactive Map */}
                  {expandedDispatchMapId === d.id && (
                    <div className="pt-2">
                      <GoogleTrackingMap
                        driverName={d.driver?.fullName || "Carrier Driver"}
                        customerName={d.destinationFacility?.name || "Destination Facility"}
                        driverLocation={
                          d.lastKnownLocation?.latitude && d.lastKnownLocation?.longitude
                            ? { lat: d.lastKnownLocation.latitude, lng: d.lastKnownLocation.longitude }
                            : { lat: 12.8399, lng: 77.677 }
                        }
                        customerLocation={{
                          lat:
                            d.destinationFacility?.location?.latitude ||
                            d.destinationFacility?.coordinates?.coordinates?.[1] ||
                            12.985,
                          lng:
                            d.destinationFacility?.location?.longitude ||
                            d.destinationFacility?.coordinates?.coordinates?.[0] ||
                            77.74,
                          address: d.destinationFacility?.address || d.pickupAddress,
                        }}
                        height="250px"
                      />
                    </div>
                  )}

                  {/* Trip History & Break Events Drawer */}
                  {expandedDispatchHistoryId === d.id && (
                    <div className="pt-2 space-y-2 border-t border-[#D7E5DB] text-xs">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#075B46] font-bold block">
                        Carrier Trip Audit Trail & Break Log
                      </span>

                      <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-2">
                        <div className="flex items-center justify-between text-[#6B7C74]">
                          <span>Trip Started:</span>
                          <span className="font-mono text-[#173C32] font-semibold">
                            {d.tripStartedAt ? new Date(d.tripStartedAt).toLocaleString() : "Not recorded"}
                          </span>
                        </div>

                        {d.breaks && d.breaks.length > 0 ? (
                          <div className="space-y-1.5 pt-1 border-t border-[#D7E5DB]">
                            <span className="text-[10px] uppercase font-mono text-[#6B7C74] font-bold">
                              Logged Breaks ({d.breaks.length}):
                            </span>
                            {d.breaks.map((b: any, idx: number) => (
                              <div
                                key={b.breakId || idx}
                                className="p-2 rounded-lg bg-white border border-[#D7E5DB] text-[11px] space-y-0.5"
                              >
                                <div className="flex items-center justify-between font-semibold text-[#173C32]">
                                  <span>{b.reason || "Driver Pause"}</span>
                                  <span className="font-mono text-amber-700">
                                    {b.endTime
                                      ? `${Math.round(
                                          (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000
                                        )} mins`
                                      : "Ongoing"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#6B7C74] flex justify-between font-mono">
                                  <span>
                                    {new Date(b.startTime).toLocaleTimeString()} -{" "}
                                    {b.endTime ? new Date(b.endTime).toLocaleTimeString() : "Now"}
                                  </span>
                                  {b.startLocation && (
                                    <span>
                                      {b.startLocation.latitude.toFixed(3)}°, {b.startLocation.longitude.toFixed(3)}°
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#6B7C74] italic pt-1 border-t border-[#D7E5DB]">
                            No driver break pauses recorded during this transit.
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[#6B7C74] pt-1 border-t border-[#D7E5DB]">
                          <span>Factory Geofence Reached:</span>
                          <span className="font-mono text-[#075B46] font-semibold">
                            {d.geofenceArrivalDetected
                              ? `Detected at ${new Date(d.geofenceArrivalTime || d.updatedAt).toLocaleTimeString()}`
                              : "En route / Pending"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[#6B7C74]">
                          <span>Delivery Official Intake:</span>
                          <span className="font-mono text-[#173C32] font-semibold">
                            {d.deliveryConfirmedAt
                              ? `Confirmed ${new Date(d.deliveryConfirmedAt).toLocaleString()}`
                              : "Pending factory weighbridge verification"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {dispatches.length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-[#D7E5DB] text-[#6B7C74] text-xs">
                  No active shipment dispatches to track.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 6: NOTIFICATIONS ================= */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold text-[#173C32]">Operational Notifications</h3>
                <p className="text-xs text-[#6B7C74] mt-0.5">
                  Real-time lifecycle events from fleet drivers, weighbridges, and processing hubs.
                </p>
              </div>

              <button
                onClick={async () => {
                  await api.markAllNotificationsRead();
                  loadData();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] text-xs font-semibold transition-colors shadow-sm"
              >
                Mark All Read
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm divide-y divide-[#D7E5DB] overflow-hidden">
              {notifications.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#6B7C74]">No notifications found.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`p-4 flex items-start justify-between gap-4 transition-colors ${n.read ? "bg-transparent opacity-70" : "bg-[#E5F5EA]/30"}`}>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#173C32]">{n.title}</span>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#075B46]" />}
                      </div>
                      <p className="text-[#6B7C74]">{n.message}</p>
                      <span className="text-[10px] text-[#6B7C74] font-mono">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {!n.read && (
                      <button
                        onClick={async () => {
                          await api.markNotificationRead(n.id);
                          loadData();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[11px] text-[#075B46] border border-[#D7E5DB] font-medium"
                      >
                        Read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      {/* ================= MODALS ================= */}

      {/* 1. Register Batch Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#075B46]" />
                <span>Register New E-Waste Batch</span>
              </h3>
              <button onClick={closeRegisterModal} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterBatch} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Estimated Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 150.5"
                    value={initialWeightKg}
                    onChange={(e) => setInitialWeightKg(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Destination Facility</label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.location || "Bengaluru Hub"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Pickup Site Address</label>
                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    setPickupLocation(e.target.value);
                  }}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Collection Date</label>
                  <input
                    type="date"
                    required
                    value={collectionDate}
                    onChange={(e) => setCollectionDate(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Source Type</label>
                  <input
                    type="text"
                    required
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Manifest Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed inventory breakdown..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Weighbridge Slip / Manifest Evidence</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 bg-[#EDF7EF] hover:bg-[#E5F5EA] border border-[#D7E5DB] rounded-xl cursor-pointer text-[#173C32]">
                    <Upload className="w-3.5 h-3.5 text-[#075B46]" />
                    <span>Upload Slip</span>
                    <input type="file" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {evidenceHash && (
                    <span className="text-[11px] font-mono text-[#075B46] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-[#075B46]" />
                      Hash: {evidenceHash.slice(0, 14)}...
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={closeRegisterModal}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Signing On-Chain..." : "Confirm & Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Batch Modal */}
      {isEditOpen && editingBatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#075B46]" />
                <span>Edit Batch: {editingBatch.batchId}</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingBatch(null);
                }}
                className="text-[#6B7C74] hover:text-[#173C32]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Category</label>
                  <select
                    value={editingBatch.categoryId}
                    onChange={(e) => setEditingBatch({ ...editingBatch, categoryId: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Initial Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingBatch.initialWeightKg}
                    onChange={(e) => setEditingBatch({ ...editingBatch, initialWeightKg: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Destination Facility</label>
                <select
                  value={editingBatch.destinationFacilityId}
                  onChange={(e) => setEditingBatch({ ...editingBatch, destinationFacilityId: e.target.value })}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Pickup Address</label>
                <input
                  type="text"
                  required
                  value={editingBatch.pickupAddress}
                  onChange={(e) => setEditingBatch({ ...editingBatch, pickupAddress: e.target.value, pickupLocation: e.target.value })}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Contact Phone</label>
                  <input
                    type="text"
                    value={editingBatch.contactPhone}
                    onChange={(e) => setEditingBatch({ ...editingBatch, contactPhone: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Contact Email</label>
                  <input
                    type="email"
                    value={editingBatch.contactEmail}
                    onChange={(e) => setEditingBatch({ ...editingBatch, contactEmail: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  value={editingBatch.description}
                  onChange={(e) => setEditingBatch({ ...editingBatch, description: e.target.value })}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Dispatch Creator Modal with Driver Capacity Check & QpiAI Opt */}
      {isDispatchOpen && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-md w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#075B46]" />
                <span>Assign Pickup Carrier</span>
              </h3>
              <button onClick={() => setIsDispatchOpen(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Batch Summary */}
            {selectedDispatchBatch && (
              <div className="p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono text-[#075B46] font-bold">{selectedDispatchBatch.batchId}</span>
                  <p className="text-[11px] text-[#6B7C74]">{selectedDispatchBatch.category?.name}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[#173C32] font-bold">{selectedDispatchBatch.initialWeightKg} kg</span>
                  <p className="text-[10px] text-[#6B7C74]">Payload Weight</p>
                </div>
              </div>
            )}

            {/* Mode Specific Dispatch Header */}
            {operatingMode === "AI" ? (
              <div className="p-3.5 rounded-2xl bg-[#E5F5EA]/60 border border-[#075B46]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#173C32] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#075B46]" />
                    <span>QpiAI Route Optimizer & Driver AI</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleOptimizeRoute}
                    disabled={optimizingRoute}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#E5F5EA] text-[#075B46] border border-[#075B46]/30 text-[11px] font-semibold transition-colors shadow-sm"
                  >
                    {optimizingRoute ? "Optimizing..." : "Analyze Route"}
                  </button>
                </div>

                {optimizationResult ? (
                  <div className="text-[11px] space-y-1 text-[#173C32] pt-1 border-t border-[#D7E5DB]">
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Optimization Engine:</span>
                      <span className="font-mono text-[#075B46] font-bold">{optimizationResult.engine}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Total Route Distance:</span>
                      <span className="font-mono font-bold">{optimizationResult.totalDistanceKm} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">CO2 Emissions Saved:</span>
                      <span className="font-mono text-[#075B46] font-bold">{optimizationResult.carbonSavingsKg} kg CO2</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#6B7C74]">
                    AI Mode: Calculate optimal carrier assignment and waypoint transit using QpiAI quantum optimization heuristics.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <Layers className="w-4 h-4 text-amber-700" />
                  <span>Manual Mode Active (Operator Direct Assignment)</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Direct database assignment without AI dependency. This assignment is protected from automated overwrites.
                </p>
              </div>
            )}

            <form onSubmit={handleCreateDispatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Select Registered Driver</label>
                <select
                  value={driverId}
                  onChange={(e) => handleDriverSelectChange(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46] font-medium"
                >
                  {drivers.map((d) => {
                    const isAvail = d.availability === "AVAILABLE";
                    const isCapOk = !selectedDispatchBatch || !d.loadCapacityKg || d.loadCapacityKg >= selectedDispatchBatch.initialWeightKg;
                    const rec = driverRecommendations.find((r) => r.driverId === d.driverId || r.id === d.id);
                    const recLabel = rec && operatingMode === "AI" ? ` [⭐ Score: ${rec.suitabilityScore}%]` : "";
                    return (
                      <option key={d.id} value={d.id}>
                        {d.fullName} — {d.vehicleRegistration} (Max: {d.loadCapacityKg}kg) [{d.availability}]{recLabel}
                        {!isCapOk ? " [OVER CAPACITY]" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {operatingMode === "MANUAL" && (
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Manual Assignment Notes / Override Reason (Optional)</label>
                  <input
                    type="text"
                    value={manualOverrideReason}
                    onChange={(e) => setManualOverrideReason(e.target.value)}
                    placeholder="e.g., Designated operator dispatch, customer preference..."
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              )}

              {/* Driver Selected Details Banner */}
              {(() => {
                const chosen = drivers.find((d) => d.id === driverId);
                if (!chosen) return null;
                const isOverCap = selectedDispatchBatch && chosen.loadCapacityKg && selectedDispatchBatch.initialWeightKg > chosen.loadCapacityKg;
                const isUnavailable = chosen.availability !== "AVAILABLE";

                return (
                  <div className="p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Vehicle Type:</span>
                      <span className="text-[#173C32] font-medium">{chosen.vehicleType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Vehicle Registration:</span>
                      <span className="font-mono text-[#075B46] font-bold">{chosen.vehicleRegistration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Load Capacity:</span>
                      <span className="font-mono text-[#173C32] font-semibold">{chosen.loadCapacityKg?.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Carrier Status:</span>
                      <span className={`font-mono font-bold ${chosen.availability === "AVAILABLE" ? "text-emerald-700" : "text-amber-700"}`}>
                        {chosen.availability}
                      </span>
                    </div>

                    {isOverCap && (
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold mt-2">
                        ⚠️ Warning: Batch weight exceeds vehicle maximum capacity!
                      </div>
                    )}
                    {isUnavailable && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold mt-2">
                        ⚠️ Warning: Driver is currently {chosen.availability}.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Vehicle Registration Plate</label>
                <input
                  type="text"
                  required
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Pickup Site Address</label>
                <input
                  type="text"
                  required
                  value={dispatchPickupAddress}
                  onChange={(e) => setDispatchPickupAddress(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setIsDispatchOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Signing Dispatch..." : "Authorize Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Driver Modal */}
      {isAddDriverOpen && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#075B46]" />
                <span>Register New Fleet Driver</span>
              </h3>
              <button onClick={() => setIsAddDriverOpen(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {driverFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {driverFormError}
              </div>
            )}

            <form onSubmit={handleCreateDriver} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra"
                    value={newDriverFullName}
                    onChange={(e) => setNewDriverFullName(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Driver ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DRV-2026-004"
                    value={newDriverId}
                    onChange={(e) => setNewDriverId(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98450 XXXXX"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="driver@logistics.com"
                    value={newDriverEmail}
                    onChange={(e) => setNewDriverEmail(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Vehicle Type *</label>
                  <select
                    value={newDriverVehicleType}
                    onChange={(e) => setNewDriverVehicleType(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="Heavy Electric E-Truck">Heavy Electric E-Truck</option>
                    <option value="Medium Transit Electric Van">Medium Transit Electric Van</option>
                    <option value="Heavy Flatbed Carrier">Heavy Flatbed Carrier</option>
                    <option value="Light Commercial Flatbed">Light Commercial Flatbed</option>
                    <option value="Hazardous Battery Hauler">Hazardous Battery Hauler</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Registration Plate *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KA-04-TR-9988"
                    value={newDriverVehicleReg}
                    onChange={(e) => setNewDriverVehicleReg(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Load Capacity (kg) *</label>
                  <input
                    type="number"
                    required
                    min="50"
                    placeholder="e.g. 3500"
                    value={newDriverCapacityKg}
                    onChange={(e) => setNewDriverCapacityKg(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">License Number</label>
                  <input
                    type="text"
                    placeholder="e.g. DL-KA-04-2020-9988"
                    value={newDriverLicense}
                    onChange={(e) => setNewDriverLicense(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Initial Availability</label>
                  <select
                    value={newDriverAvailability}
                    onChange={(e) => setNewDriverAvailability(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFF_DUTY">OFF DUTY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Notes / Specialization</label>
                  <input
                    type="text"
                    placeholder="e.g. Battery transport certified"
                    value={newDriverNotes}
                    onChange={(e) => setNewDriverNotes(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setIsAddDriverOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Registering..." : "Confirm & Add Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Edit Driver Modal */}
      {isEditDriverOpen && editingDriver && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif font-bold text-[#173C32] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#075B46]" />
                <span>Edit Driver: {editingDriver.driverId}</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditDriverOpen(false);
                  setEditingDriver(null);
                }}
                className="text-[#6B7C74] hover:text-[#173C32]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {driverFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {driverFormError}
              </div>
            )}

            <form onSubmit={handleSaveEditDriver} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingDriver.fullName}
                    onChange={(e) => setEditingDriver({ ...editingDriver, fullName: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Phone</label>
                  <input
                    type="text"
                    required
                    value={editingDriver.phone}
                    onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    required
                    value={editingDriver.email}
                    onChange={(e) => setEditingDriver({ ...editingDriver, email: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">License Number</label>
                  <input
                    type="text"
                    value={editingDriver.licenseNumber}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenseNumber: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Vehicle Type</label>
                  <input
                    type="text"
                    required
                    value={editingDriver.vehicleType}
                    onChange={(e) => setEditingDriver({ ...editingDriver, vehicleType: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Vehicle Registration</label>
                  <input
                    type="text"
                    required
                    value={editingDriver.vehicleRegistration}
                    onChange={(e) => setEditingDriver({ ...editingDriver, vehicleRegistration: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Load Capacity (kg)</label>
                  <input
                    type="number"
                    required
                    value={editingDriver.loadCapacityKg}
                    onChange={(e) => setEditingDriver({ ...editingDriver, loadCapacityKg: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#075B46]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Availability Status</label>
                  <select
                    value={editingDriver.availability}
                    onChange={(e) => setEditingDriver({ ...editingDriver, availability: e.target.value })}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ON_TRIP">ON TRIP</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFF_DUTY">OFF DUTY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Notes</label>
                <textarea
                  rows={2}
                  value={editingDriver.notes}
                  onChange={(e) => setEditingDriver({ ...editingDriver, notes: e.target.value })}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setIsEditDriverOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Driver Details & Historical Trips Modal */}
      {isDriverDetailsOpen && selectedDriverDetails && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-[#D7E5DB]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E5F5EA] text-[#075B46] flex items-center justify-center font-bold text-base shadow-sm">
                  <Truck className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-serif font-bold text-[#173C32]">{selectedDriverDetails.fullName}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB]">
                      {selectedDriverDetails.driverId}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7C74] mt-0.5">
                    {selectedDriverDetails.phone} • {selectedDriverDetails.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsDriverDetailsOpen(false);
                  setSelectedDriverDetails(null);
                }}
                className="text-[#6B7C74] hover:text-[#173C32]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDriverDetails ? (
              <div className="py-12 text-center text-xs text-[#6B7C74]">Loading driver performance records...</div>
            ) : (
              <div className="space-y-6">
                {/* Driver Vehicle & Specs Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                    <span className="text-[10px] text-[#6B7C74] font-mono uppercase block">Vehicle Registration</span>
                    <span className="font-mono font-bold text-[#173C32]">{selectedDriverDetails.vehicleRegistration}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                    <span className="text-[10px] text-[#6B7C74] font-mono uppercase block">Vehicle Type</span>
                    <span className="text-[#173C32] truncate block font-medium">{selectedDriverDetails.vehicleType}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                    <span className="text-[10px] text-[#6B7C74] font-mono uppercase block">Max Payload</span>
                    <span className="font-mono font-bold text-[#075B46]">{selectedDriverDetails.loadCapacityKg?.toLocaleString()} kg</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                    <span className="text-[10px] text-[#6B7C74] font-mono uppercase block">License ID</span>
                    <span className="font-mono text-[#173C32]">{selectedDriverDetails.licenseNumber || "N/A"}</span>
                  </div>
                </div>

                {/* Performance Stats */}
                {selectedDriverDetails.stats && (
                  <div>
                    <h4 className="text-xs font-serif font-bold text-[#173C32] uppercase tracking-wider mb-2">Carrier Performance</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block">Total Trips Assigned</span>
                        <span className="font-mono text-lg font-bold text-[#173C32]">{selectedDriverDetails.stats.totalDispatches}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block">Completed Trips</span>
                        <span className="font-mono text-lg font-bold text-[#075B46]">{selectedDriverDetails.stats.completedShipments}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block">Active Runs</span>
                        <span className="font-mono text-lg font-bold text-[#087F5B]">{selectedDriverDetails.stats.activeShipments}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#EDF7EF]/60 border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block">Total Hauled</span>
                        <span className="font-mono text-lg font-bold text-[#173C32]">{selectedDriverDetails.stats.totalWeightTransportedKg} kg</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Assignment if active */}
                {selectedDriverDetails.currentAssignment && (
                  <div className="p-4 rounded-2xl bg-[#E5F5EA]/60 border border-[#075B46]/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#075B46] flex items-center gap-1.5">
                        <Truck className="w-4 h-4" />
                        <span>Active Shipment: {selectedDriverDetails.currentAssignment.dispatchId}</span>
                      </span>
                      <Badge status={selectedDriverDetails.currentAssignment.status} size="sm" />
                    </div>
                    <p className="text-[#173C32]">
                      Dispatched weight: <span className="font-mono font-bold text-[#173C32]">{selectedDriverDetails.currentAssignment.dispatchedWeightKg} kg</span>
                    </p>
                    <p className="text-[#6B7C74] text-[11px]">
                      Origin: {selectedDriverDetails.currentAssignment.pickupAddress}
                    </p>
                  </div>
                )}

                {/* Historical Dispatches Table */}
                <div>
                  <h4 className="text-xs font-serif font-bold text-[#173C32] uppercase tracking-wider mb-2">Trip & Handover History</h4>
                  <div className="rounded-2xl border border-[#D7E5DB] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                        <tr>
                          <th className="p-2.5">Dispatch ID</th>
                          <th className="p-2.5">Dispatched Wt</th>
                          <th className="p-2.5">Delivered Wt</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">On-Chain Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D7E5DB]">
                        {!selectedDriverDetails.history || selectedDriverDetails.history.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-[#6B7C74] text-xs">
                              No historical shipments for this driver.
                            </td>
                          </tr>
                        ) : (
                          selectedDriverDetails.history.map((h: any) => (
                            <tr key={h.id} className="hover:bg-[#F7FBF7]">
                              <td className="p-2.5 font-mono font-bold text-[#075B46]">{h.dispatchId}</td>
                              <td className="p-2.5 font-mono text-[#173C32]">{h.dispatchedWeightKg} kg</td>
                              <td className="p-2.5 font-mono text-[#173C32]">{h.deliveryWeightKg ?? "—"} kg</td>
                              <td className="p-2.5">
                                <Badge status={h.status} size="sm" />
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-[#6B7C74]">
                                {new Date(h.createdAt).toLocaleDateString()}
                              </td>
                              <td className="p-2.5 font-mono text-[10px] text-[#6B7C74] truncate max-w-[120px]">
                                {h.txHash || "Local"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-[#D7E5DB]">
                  <button
                    onClick={() => {
                      setIsDriverDetailsOpen(false);
                      handleOpenEditDriver(selectedDriverDetails);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-semibold text-xs transition-colors shadow-sm"
                  >
                    Edit Driver Profile
                  </button>
                  <button
                    onClick={() => {
                      setIsDriverDetailsOpen(false);
                      setSelectedDriverDetails(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB] text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. QR Label Modal */}
      {selectedBatchForQr && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white p-6 rounded-3xl border border-[#D7E5DB] shadow-2xl relative text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
              <span className="text-xs font-mono font-bold text-[#075B46]">{selectedBatchForQr.batchId}</span>
              <button onClick={() => setSelectedBatchForQr(null)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[#F7FBF7] border border-[#D7E5DB] rounded-2xl inline-block shadow-inner mx-auto">
              <QrCode className="w-36 h-36 text-[#075B46]" />
            </div>

            <div className="text-xs space-y-1">
              <p className="font-serif font-bold text-[#173C32] text-sm">{selectedBatchForQr.category?.name || "E-Waste Batch"}</p>
              <p className="font-mono text-[#075B46] font-semibold">{selectedBatchForQr.initialWeightKg} kg Intake Weight</p>
              <p className="text-[11px] text-[#6B7C74] truncate">{selectedBatchForQr.pickupAddress}</p>
              <p className="text-[10px] text-[#6B7C74] font-mono mt-2">
                Traceability Ref: {selectedBatchForQr.traceabilityRef || selectedBatchForQr.batchId}
              </p>
            </div>

            <button
              onClick={() => setSelectedBatchForQr(null)}
              className="w-full py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              Dismiss Label
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
