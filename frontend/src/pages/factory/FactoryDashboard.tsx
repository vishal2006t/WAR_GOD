import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  Building2,
  Scale,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  ShieldCheck,
  Clock,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Layers,
  MapPin,
  Truck,
  Check,
  Boxes,
} from "lucide-react";
import { FactoryMaterialsMarketplaceSection } from "../../components/marketplace/FactoryMaterialsMarketplaceSection";

type FactoryTab = "overview" | "materials-mkt" | "incoming" | "history" | "disputes";

export const FactoryDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<FactoryTab>("overview");
  const [incoming, setIncoming] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [incomingSearch, setIncomingSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDisputeFilter, setHistoryDisputeFilter] = useState("ALL");

  // Feedback Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal State
  const [selectedDispatch, setSelectedDispatch] = useState<any | null>(null);
  const [measuredWeightKg, setMeasuredWeightKg] = useState("");
  const [acceptedWeightKg, setAcceptedWeightKg] = useState("");
  const [rejectedWeightKg, setRejectedWeightKg] = useState("0");
  const [storageLocation, setStorageLocation] = useState("Bay-A-Shelves-04");
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync tab with React Router location.hash
  useEffect(() => {
    const h = location.hash.replace("#", "").toLowerCase() as FactoryTab;
    if (["overview", "materials-mkt", "incoming", "history", "disputes"].includes(h)) {
      setActiveTab(h);
    } else if (!h) {
      setActiveTab("overview");
    }
  }, [location.hash]);

  const navigateTab = (tab: FactoryTab) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incRes, histRes] = await Promise.all([
        api.getIncomingShipments(),
        api.getReceivingHistory(),
      ]);

      if (incRes.success) setIncoming(incRes.incoming);
      if (histRes.success) setHistory(histRes.records);
    } catch (err) {
      console.error("Failed to load factory data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReceiveModal = (dispatch: any) => {
    setSelectedDispatch(dispatch);
    setMeasuredWeightKg(dispatch.dispatchedWeightKg.toString());
    setAcceptedWeightKg(dispatch.dispatchedWeightKg.toString());
    setRejectedWeightKg("0");
    setDiscrepancyReason("");
    setOtpInput("");
    setInspectionNotes("Intact security seals. No tampering detected during transit.");
    setActionError(null);
  };

  const handleConfirmReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;

    const measured = Number(measuredWeightKg);
    const accepted = Number(acceptedWeightKg);
    const rejected = Number(rejectedWeightKg);

    if (accepted + rejected > measured + 0.05) {
      setActionError("Accepted weight + Rejected weight cannot exceed measured weight!");
      return;
    }

    const weightDiff = Math.abs(selectedDispatch.dispatchedWeightKg - measured);
    const hasDiscrepancy = weightDiff > 0.5;

    if (hasDiscrepancy && !discrepancyReason.trim()) {
      setActionError(`Discrepancy detected: Dispatched was ${selectedDispatch.dispatchedWeightKg} kg, but measured is ${measured} kg. A discrepancy explanation is mandatory!`);
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const res = await api.confirmReceiving({
        dispatchId: selectedDispatch.id,
        measuredWeightKg: measured,
        acceptedWeightKg: accepted,
        rejectedWeightKg: rejected,
        discrepancyReason: discrepancyReason || undefined,
        inspectionNotes,
        storageLocation,
        isDisputed: hasDiscrepancy,
        otp: otpInput.trim() || undefined,
      });

      if (res.success) {
        setSelectedDispatch(null);
        setActionSuccess(`Shipment ${selectedDispatch.dispatchId} verified & received on-chain (${measured} kg).`);
        setTimeout(() => setActionSuccess(null), 5000);
        loadData();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to confirm receiving");
    } finally {
      setSubmitting(false);
    }
  };

  const totalReceivedKg = history.reduce((acc, r) => acc + (r.measuredWeightKg || 0), 0);
  const disputedCount = history.filter((r) => r.isDisputed).length;

  // Filtered incoming
  const filteredIncoming = incoming.filter((d) => {
    if (!incomingSearch) return true;
    const q = incomingSearch.toLowerCase();
    return (
      d.dispatchId?.toLowerCase().includes(q) ||
      d.vehicleRegistration?.toLowerCase().includes(q) ||
      d.driver?.fullName?.toLowerCase().includes(q) ||
      d.pickupAddress?.toLowerCase().includes(q)
    );
  });

  // Filtered history
  const filteredHistory = history.filter((r) => {
    const matchesDispute =
      historyDisputeFilter === "ALL"
        ? true
        : historyDisputeFilter === "DISPUTED"
        ? r.isDisputed
        : !r.isDisputed;

    if (!matchesDispute) return false;
    if (!historySearch) return true;

    const q = historySearch.toLowerCase();
    return (
      r.batch?.batchId?.toLowerCase().includes(q) ||
      r.dispatch?.dispatchId?.toLowerCase().includes(q) ||
      r.storageLocation?.toLowerCase().includes(q) ||
      r.discrepancyNotes?.toLowerCase().includes(q)
    );
  });

  const disputedHistory = history.filter((r) => r.isDisputed);

  if (loading && incoming.length === 0 && history.length === 0) {
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
          <h1 className="text-2xl sm:text-3xl font-serif text-[#173C32]">Factory Intake & Weighbridge Station</h1>
          <p className="text-xs text-[#6B7C74] mt-1 font-sans">
            Verify physical incoming e-waste loads, compare weighbridge measurements against dispatch manifests, and audit discrepancies.
          </p>
        </div>

        <button
          onClick={loadData}
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

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Incoming Shipments"
          value={incoming.length}
          subtitle="Awaiting gate weighbridge intake"
          icon={Building2}
          color="amber"
        />
        <StatCard
          title="Verified Intake Mass"
          value={`${totalReceivedKg.toFixed(1)} kg`}
          subtitle="Accepted into facility storage"
          icon={Scale}
          color="emerald"
        />
        <StatCard
          title="Discrepancy Disputes"
          value={disputedCount}
          subtitle="Weight variance investigations"
          icon={AlertTriangle}
          color={disputedCount > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Horizontal Sub-Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#D7E5DB] pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: "overview", label: "Overview & Station Summary", icon: Layers },
          { id: "materials-mkt", label: "Recovered Materials Mkt", icon: Boxes },
          { id: "incoming", label: `Incoming Shipments (${incoming.length})`, icon: Building2 },
          { id: "history", label: `Weighbridge History (${history.length})`, icon: Scale },
          { id: "disputes", label: `Disputed Weighings (${disputedCount})`, icon: AlertTriangle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateTab(tab.id as FactoryTab)}
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

      {/* RECOVERED MATERIALS MARKETPLACE TAB */}
      {activeTab === "materials-mkt" && <FactoryMaterialsMarketplaceSection />}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Pending Shipments Summary */}
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden space-y-4">
            <div className="p-5 border-b border-[#D7E5DB] flex items-center justify-between">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#087F5B]" />
                <span>Pending Intake Queue ({incoming.length})</span>
              </h3>
              <button
                onClick={() => navigateTab("incoming")}
                className="text-xs text-[#087F5B] hover:text-[#075B46] font-semibold"
              >
                View Full Queue →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Dispatch ID</th>
                    <th className="p-3">Carrier / Driver</th>
                    <th className="p-3">Vehicle Plate</th>
                    <th className="p-3">Dispatched Mass</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {incoming.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#6B7C74]">
                        No shipments currently awaiting intake. All gate arrivals cleared.
                      </td>
                    </tr>
                  ) : (
                    incoming.slice(0, 5).map((d) => (
                      <tr key={d.id} className="hover:bg-[#F7FBF7]">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{d.dispatchId}</td>
                        <td className="p-3 text-[#173C32] font-medium">{d.driver?.fullName || "Assigned Driver"}</td>
                        <td className="p-3 font-mono text-[#6B7C74]">{d.vehicleRegistration}</td>
                        <td className="p-3 font-mono text-[#173C32] font-bold">{d.dispatchedWeightKg} kg</td>
                        <td className="p-3">
                          <Badge status={d.status} size="sm" />
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleOpenReceiveModal(d)}
                            className="px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>Weigh & Receive</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Intakes */}
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden space-y-4">
            <div className="p-5 border-b border-[#D7E5DB] flex items-center justify-between">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#087F5B]" />
                <span>Recent Audited Weighings</span>
              </h3>
              <button
                onClick={() => navigateTab("history")}
                className="text-xs text-[#087F5B] hover:text-[#075B46] font-semibold"
              >
                View All History →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Dispatch Ref</th>
                    <th className="p-3">Measured Mass</th>
                    <th className="p-3">Accepted / Rejected</th>
                    <th className="p-3">Discrepancy</th>
                    <th className="p-3">Storage Bay</th>
                    <th className="p-3">Intake Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[#6B7C74]">
                        No weighbridge records yet.
                      </td>
                    </tr>
                  ) : (
                    history.slice(0, 5).map((r) => (
                      <tr key={r.id} className="hover:bg-[#F7FBF7]">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{r.batch?.batchId}</td>
                        <td className="p-3 font-mono text-[#6B7C74]">{r.dispatch?.dispatchId}</td>
                        <td className="p-3 font-mono font-bold text-[#173C32]">{r.measuredWeightKg} kg</td>
                        <td className="p-3 font-mono text-[#6B7C74]">
                          <span className="text-[#087F5B] font-semibold">{r.acceptedWeightKg} kg</span> /{" "}
                          <span className="text-rose-600 font-semibold">{r.rejectedWeightKg} kg</span>
                        </td>
                        <td className="p-3">
                          <Badge status={r.isDisputed ? "DISPUTED" : "CONFIRMED"} size="sm" />
                        </td>
                        <td className="p-3 text-[#173C32] font-mono">{r.storageLocation || "Vault 1"}</td>
                        <td className="p-3 text-[#6B7C74] text-[11px]">
                          {new Date(r.arrivalTime).toLocaleString()}
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

      {/* TAB 2: INCOMING SHIPMENTS QUEUE */}
      {activeTab === "incoming" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
              <input
                type="text"
                placeholder="Search by Dispatch ID, carrier name, vehicle plate..."
                value={incomingSearch}
                onChange={(e) => setIncomingSearch(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
              />
            </div>
            <span className="text-xs font-mono text-[#6B7C74]">
              Showing {filteredIncoming.length} of {incoming.length} incoming loads
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Dispatch ID</th>
                    <th className="p-3">Carrier / Driver</th>
                    <th className="p-3">Vehicle Plate</th>
                    <th className="p-3">Dispatched Mass</th>
                    <th className="p-3">Origin Depot</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Weighbridge Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {filteredIncoming.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#6B7C74] text-xs">
                        {incomingSearch ? "No incoming shipments match search filter." : "No shipments currently pending intake."}
                      </td>
                    </tr>
                  ) : (
                    filteredIncoming.map((d) => (
                      <tr key={d.id} className="hover:bg-[#F7FBF7]">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{d.dispatchId}</td>
                        <td className="p-3 text-[#173C32] font-medium">{d.driver?.fullName || "Assigned Carrier"}</td>
                        <td className="p-3 font-mono text-[#6B7C74]">{d.vehicleRegistration}</td>
                        <td className="p-3 font-mono text-[#173C32] font-bold">{d.dispatchedWeightKg} kg</td>
                        <td className="p-3 text-[#6B7C74] text-[11px] truncate max-w-xs">{d.pickupAddress}</td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Badge status={d.status} size="sm" />
                            {d.status === "ARRIVED_AT_FACTORY" && (
                              <span className="block text-[10px] text-emerald-800 font-mono font-bold">
                                🎯 AT GATE PERIMETER
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleOpenReceiveModal(d)}
                            className="px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>Weigh & Receive</span>
                          </button>
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

      {/* TAB 3: WEIGHBRIDGE HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                <input
                  type="text"
                  placeholder="Search by Batch ID, Dispatch ID, storage bay..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
                />
              </div>
              <select
                value={historyDisputeFilter}
                onChange={(e) => setHistoryDisputeFilter(e.target.value)}
                className="bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
              >
                <option value="ALL">All Records</option>
                <option value="CONFIRMED">Confirmed Only</option>
                <option value="DISPUTED">Disputed Only</option>
              </select>
            </div>
            <span className="text-xs font-mono text-[#6B7C74]">
              Showing {filteredHistory.length} of {history.length} records
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Dispatch Ref</th>
                    <th className="p-3">Measured Mass</th>
                    <th className="p-3">Accepted Mass</th>
                    <th className="p-3">Rejected Mass</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Storage Bay</th>
                    <th className="p-3">Discrepancy Notes</th>
                    <th className="p-3">Intake Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#6B7C74] text-xs">
                        No intake history records match criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((r) => (
                      <tr key={r.id} className="hover:bg-[#F7FBF7]">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{r.batch?.batchId}</td>
                        <td className="p-3 font-mono text-[#6B7C74]">{r.dispatch?.dispatchId}</td>
                        <td className="p-3 font-mono font-bold text-[#173C32]">{r.measuredWeightKg} kg</td>
                        <td className="p-3 font-mono text-[#087F5B] font-semibold">{r.acceptedWeightKg} kg</td>
                        <td className="p-3 font-mono text-rose-600 font-semibold">{r.rejectedWeightKg} kg</td>
                        <td className="p-3">
                          <Badge status={r.isDisputed ? "DISPUTED" : "CONFIRMED"} size="sm" />
                        </td>
                        <td className="p-3 text-[#173C32] font-mono">{r.storageLocation || "Vault 1"}</td>
                        <td className="p-3 text-[#6B7C74] text-[11px] truncate max-w-xs">
                          {r.discrepancyNotes || r.inspectionNotes || "—"}
                        </td>
                        <td className="p-3 text-[#6B7C74] text-[11px] font-sans">
                          {new Date(r.arrivalTime).toLocaleString()}
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

      {/* TAB 4: DISPUTED WEIGHINGS */}
      {activeTab === "disputes" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Discrepancy Threshold: Weight differences exceeding 0.5 kg require mandatory explanation and trigger formal audit disputes.
              </span>
            </div>
            <span className="font-mono font-bold text-amber-800">{disputedHistory.length} Flagged Loads</span>
          </div>

          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Dispatch ID</th>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Dispatched Mass</th>
                    <th className="p-3">Measured Mass</th>
                    <th className="p-3">Variance</th>
                    <th className="p-3">Discrepancy Explanation</th>
                    <th className="p-3">Storage Allocation</th>
                    <th className="p-3">Flagged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {disputedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#6B7C74] text-xs">
                        No disputed weighings currently on record. All physical shipments reconciled cleanly within tolerance.
                      </td>
                    </tr>
                  ) : (
                    disputedHistory.map((r) => {
                      const dispatched = r.dispatch?.dispatchedWeightKg || 0;
                      const measured = r.measuredWeightKg || 0;
                      const variance = Math.abs(dispatched - measured).toFixed(2);

                      return (
                        <tr key={r.id} className="hover:bg-[#F7FBF7] bg-rose-50/30">
                          <td className="p-3 font-mono font-bold text-[#075B46]">{r.dispatch?.dispatchId}</td>
                          <td className="p-3 font-mono text-[#6B7C74]">{r.batch?.batchId}</td>
                          <td className="p-3 font-mono text-[#6B7C74]">{dispatched} kg</td>
                          <td className="p-3 font-mono text-[#173C32] font-bold">{measured} kg</td>
                          <td className="p-3 font-mono font-bold text-rose-600">± {variance} kg</td>
                          <td className="p-3 text-[#173C32] font-medium">{r.discrepancyNotes || "Discrepancy logged"}</td>
                          <td className="p-3 font-mono text-[#6B7C74]">{r.storageLocation || "Quarantine Bay"}</td>
                          <td className="p-3 text-[#6B7C74] text-[11px]">
                            {new Date(r.arrivalTime).toLocaleString()}
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

      {/* Weighbridge Intake Modal */}
      {selectedDispatch && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-modal relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif text-[#173C32] flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#087F5B]" />
                <span>Weighbridge Receiving: {selectedDispatch.dispatchId}</span>
              </h3>
              <button onClick={() => setSelectedDispatch(null)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dispatched Weight Alert */}
            <div className="p-3 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] flex items-center justify-between text-xs">
              <span className="text-[#6B7C74]">Carrier Manifest Dispatched Mass:</span>
              <span className="font-mono font-bold text-[#075B46] text-sm">
                {selectedDispatch.dispatchedWeightKg} kg
              </span>
            </div>

            <form onSubmit={handleConfirmReceiving} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Actual Measured Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={measuredWeightKg}
                  onChange={(e) => setMeasuredWeightKg(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono text-sm font-bold focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Accepted Mass (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={acceptedWeightKg}
                    onChange={(e) => setAcceptedWeightKg(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#087F5B] font-mono font-bold focus:outline-none focus:border-[#087F5B]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Rejected Mass (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={rejectedWeightKg}
                    onChange={(e) => setRejectedWeightKg(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-rose-600 font-mono font-bold focus:outline-none focus:border-[#087F5B]"
                  />
                </div>
              </div>

              {/* Live Discrepancy Alert */}
              {Math.abs(selectedDispatch.dispatchedWeightKg - Number(measuredWeightKg)) > 0.5 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Weight Discrepancy Detected ({Math.abs(selectedDispatch.dispatchedWeightKg - Number(measuredWeightKg)).toFixed(1)} kg difference)</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-rose-800 mb-1 font-medium">
                      Mandatory Discrepancy Reason:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Broken packaging / loss during haulage / moisture drying..."
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-1.5 text-[#173C32] text-xs focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Storage Bay / Vault Allocation</label>
                <input
                  type="text"
                  required
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              {/* Geofence Detection Status if detected */}
              {selectedDispatch.geofenceArrivalDetected && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Geofence Gate Perimeter Arrival Detected</span>
                  </span>
                  <span className="font-mono text-[11px] text-emerald-700">
                    {selectedDispatch.geofenceArrivalTime
                      ? new Date(selectedDispatch.geofenceArrivalTime).toLocaleTimeString()
                      : "Verified"}
                  </span>
                </div>
              )}

              {/* Secure Delivery OTP Input */}
              <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-1.5">
                <label className="block text-[#173C32] font-medium flex items-center justify-between">
                  <span>Carrier Driver Delivery OTP:</span>
                  <span className="text-[10px] text-[#6B7C74] font-mono">From Driver App / Manifest</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP code (e.g. 684291)"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#075B46] font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-[#087F5B]"
                />
                <p className="text-[10px] text-[#6B7C74]">
                  Verifies that the authorized carrier driver is physically present with the delivery consignment.
                </p>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Quality Inspection Notes</label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispatch(null)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#173C32] font-medium border border-[#D7E5DB] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold disabled:opacity-50 shadow-sm transition-all"
                >
                  {submitting ? "Signing On-Chain..." : "Confirm Gate Receiving"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryDashboard;
