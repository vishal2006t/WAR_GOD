import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import { MassBalanceCalculator } from "../../components/ui/MassBalanceCalculator";
import {
  Wrench,
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  Recycle,
  Cpu,
  Layers,
  X,
  ShieldCheck,
  Boxes,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

type WorkerTab = "overview" | "massbalance" | "materials" | "refurb" | "history";

export const WorkerDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<WorkerTab>("overview");
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [processingRecords, setProcessingRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [materialSearch, setMaterialSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");

  // Feedback Alerts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Processing Form / Modal State
  const [isProcessingOpen, setIsProcessingOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [inputWeightKg, setInputWeightKg] = useState<number>(100);
  const [residualKg, setResidualKg] = useState<number>(20);
  const [documentedLossKg, setDocumentedLossKg] = useState<number>(5);
  const [recoveredList, setRecoveredList] = useState<
    { materialType: string; weightKg: number; purityPercentage: number; location: string }[]
  >([
    { materialType: "Electrolytic Copper Cathode", weightKg: 40, purityPercentage: 99.8, location: "Vault 1" },
    { materialType: "Aerospace Aluminum Scrap", weightKg: 35, purityPercentage: 98.5, location: "Bay 3" },
  ]);

  // Refurbished Product Form / Modal State
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [prodName, setProdName] = useState("Lenovo ThinkPad X1 Carbon (Eco-Refurbished)");
  const [prodBrand, setProdBrand] = useState("Lenovo ThinkPad X1");
  const [prodSerial, setProdSerial] = useState(`SN-LENOVO-${Math.floor(100000 + Math.random() * 900000)}`);
  const [prodCondition, setProdCondition] = useState("Grade A - Certified Pristine");
  const [replacedParts, setReplacedParts] = useState("New OEM 57Wh Battery, 1TB Samsung 980 Pro SSD, Arctic MX-4 Repaste");
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  const [submitting, setSubmitting] = useState(false);

  // Sync tab with React Router location.hash
  useEffect(() => {
    const h = location.hash.replace("#", "").toLowerCase() as WorkerTab;
    if (["overview", "massbalance", "materials", "refurb", "history"].includes(h)) {
      setActiveTab(h);
    } else if (!h) {
      setActiveTab("overview");
    }
  }, [location.hash]);

  const navigateTab = (tab: WorkerTab) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [availRes, procRes, matRes] = await Promise.all([
        api.getAvailableBatchesForWorker(),
        api.getProcessingRecords(),
        api.getMaterials(),
      ]);

      if (availRes.success) {
        setAvailableBatches(availRes.batches);
        if (availRes.batches.length > 0 && !selectedBatchId) {
          setSelectedBatchId(availRes.batches[0].id);
          setInputWeightKg(availRes.batches[0].initialWeightKg);
        }
      }
      if (procRes.success) setProcessingRecords(procRes.records);
      if (matRes.success) setMaterials(matRes.materials);
    } catch (err) {
      console.error("Failed to load worker data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSelectChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    const b = availableBatches.find((item) => item.id === batchId);
    if (b) {
      setInputWeightKg(b.initialWeightKg);
    }
  };

  const handleAddMaterialRow = () => {
    setRecoveredList([
      ...recoveredList,
      { materialType: "High-Grade ABS Polymer", weightKg: 10, purityPercentage: 95.0, location: "Silo 2" },
    ]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    setRecoveredList(recoveredList.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (index: number, field: string, val: any) => {
    const updated = [...recoveredList];
    (updated[index] as any)[field] = val;
    setRecoveredList(updated);
  };

  const totalRecoveredKg = Number(
    recoveredList.reduce((acc, m) => acc + (Number(m.weightKg) || 0), 0).toFixed(2)
  );

  const totalOutputKg = Number((totalRecoveredKg + Number(residualKg) + Number(documentedLossKg)).toFixed(2));
  const massBalanceDiff = Math.abs(Number(inputWeightKg) - totalOutputKg);
  const isMassBalanceValid = massBalanceDiff <= 0.05;

  const handleSubmitProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!isMassBalanceValid) {
      setActionError(
        `Mass balance reconciliation failure! Input (${inputWeightKg} kg) must equal Total Outputs (${totalOutputKg} kg). Difference: ${massBalanceDiff.toFixed(2)} kg (tolerance is 0.05 kg).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.recordProcessing({
        sourceBatchId: selectedBatchId,
        inputWeightKg: Number(inputWeightKg),
        materials: recoveredList.map((m) => ({
          ...m,
          weightKg: Number(m.weightKg),
        })),
        residualKg: Number(residualKg),
        documentedLossKg: Number(documentedLossKg),
      });

      if (res.success) {
        setIsProcessingOpen(false);
        setActionSuccess(`Processing run ${res.record?.processingId || "completed"} confirmed on-chain. Mass balance 100% reconciled.`);
        setTimeout(() => setActionSuccess(null), 5000);
        loadData();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit processing record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);
    try {
      const res = await api.createProduct({
        name: prodName,
        brandModel: prodBrand,
        serialNumber: prodSerial,
        sourceBatchId: selectedBatchId || undefined,
        condition: prodCondition,
        replacedComponents: replacedParts,
        technicianName: "Suresh Patil (Senior Specialist)",
        warrantyMonths: Number(warrantyMonths),
      });

      if (res.success) {
        setIsProductOpen(false);
        setActionSuccess(`Refurbished product registered on-chain with Serial: ${prodSerial}`);
        setProdSerial(`SN-LENOVO-${Math.floor(100000 + Math.random() * 900000)}`);
        setTimeout(() => setActionSuccess(null), 5000);
        loadData();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to register product");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Materials
  const filteredMaterials = materials.filter((m) => {
    if (!materialSearch) return true;
    const q = materialSearch.toLowerCase();
    return (
      m.materialType?.toLowerCase().includes(q) ||
      m.storageLocation?.toLowerCase().includes(q) ||
      m.sourceBatchId?.toLowerCase().includes(q)
    );
  });

  // Filtered History
  const filteredHistory = processingRecords.filter((p) => {
    const matchesStatus =
      historyStatusFilter === "ALL"
        ? true
        : historyStatusFilter === "CONFIRMED"
        ? p.massBalanceValid
        : !p.massBalanceValid;

    if (!matchesStatus) return false;
    if (!historySearch) return true;

    const q = historySearch.toLowerCase();
    return (
      p.processingId?.toLowerCase().includes(q) ||
      p.sourceBatch?.batchId?.toLowerCase().includes(q) ||
      p.txHash?.toLowerCase().includes(q)
    );
  });

  if (loading && availableBatches.length === 0 && processingRecords.length === 0) {
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
          <h1 className="text-2xl sm:text-3xl font-serif text-[#173C32]">Recycling & Mass-Balance Workbench</h1>
          <p className="text-xs text-[#6B7C74] mt-1 font-sans">
            Perform disassemblies, calculate strict mass-balance reconciliations, and record recovered certified materials on-chain.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsProductOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E5F5EA] hover:bg-[#EDF7EF] text-[#075B46] font-semibold text-xs border border-[#D7E5DB] shadow-sm transition-all"
          >
            <Cpu className="w-4 h-4 text-[#087F5B]" />
            <span>Register Refurbished Product</span>
          </button>
          <button
            onClick={() => setIsProcessingOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Record Processing Run</span>
          </button>
        </div>
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
          title="Batches Awaiting Processing"
          value={availableBatches.length}
          subtitle="Received in facility storage"
          icon={Layers}
          color="amber"
        />
        <StatCard
          title="Completed Reconciliations"
          value={processingRecords.length}
          subtitle="Audited mass-balance runs"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Certified Recovered Lots"
          value={materials.length}
          subtitle="Non-ferrous, precious & polymers"
          icon={Boxes}
          color="blue"
        />
      </div>

      {/* Horizontal Sub-Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#D7E5DB] pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: "overview", label: "Workbench Overview", icon: Layers },
          { id: "massbalance", label: "Mass Balance Engine", icon: Wrench },
          { id: "materials", label: `Recovered Materials (${materials.length})`, icon: Boxes },
          { id: "refurb", label: "Refurbished Goods", icon: Cpu },
          { id: "history", label: `Processing History (${processingRecords.length})`, icon: CheckCircle2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateTab(tab.id as WorkerTab)}
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

      {/* TAB 1: WORKBENCH OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Live Mass-Balance Reconciler Demo Widget */}
          <MassBalanceCalculator
            inputWeightKg={inputWeightKg}
            recoveredTotalKg={totalRecoveredKg}
            residualWasteKg={Number(residualKg) || 0}
            documentedLossKg={Number(documentedLossKg) || 0}
          />

          {/* Quick Intake Batches Ready for Processing */}
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden space-y-4">
            <div className="p-5 border-b border-[#D7E5DB] flex items-center justify-between">
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#087F5B]" />
                <span>Intake Batches in Facility Storage Ready for Recovery</span>
              </h3>
              <span className="text-xs text-[#6B7C74] font-mono">{availableBatches.length} Batches</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Intake Weight</th>
                    <th className="p-3">Origin Location</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {availableBatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#6B7C74]">
                        No received batches currently awaiting processing.
                      </td>
                    </tr>
                  ) : (
                    availableBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F7FBF7]">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{b.batchId}</td>
                        <td className="p-3 text-[#173C32] font-medium">{b.category?.name || "E-Waste"}</td>
                        <td className="p-3 font-mono text-[#173C32] font-bold">{b.initialWeightKg} kg</td>
                        <td className="p-3 text-[#6B7C74] text-[11px] truncate max-w-xs">{b.pickupAddress || b.pickupLocation}</td>
                        <td className="p-3">
                          <Badge status={b.status} size="sm" />
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              setSelectedBatchId(b.id);
                              setInputWeightKg(b.initialWeightKg);
                              setIsProcessingOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Process Batch</span>
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

      {/* TAB 2: MASS BALANCE ENGINE */}
      {activeTab === "massbalance" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <div>
                <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#087F5B]" />
                  <span>Operational Mass-Balance Verification Formula</span>
                </h3>
                <p className="text-xs text-[#6B7C74] mt-0.5">
                  Input Weight = Total Recovered Material + Residual Waste + Documented Process Loss (± 0.05 kg tolerance)
                </p>
              </div>
              <button
                onClick={() => setIsProcessingOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-sm transition-all"
              >
                Open Processing Form
              </button>
            </div>

            <MassBalanceCalculator
              inputWeightKg={inputWeightKg}
              recoveredTotalKg={totalRecoveredKg}
              residualWasteKg={Number(residualKg) || 0}
              documentedLossKg={Number(documentedLossKg) || 0}
            />
          </div>
        </div>
      )}

      {/* TAB 3: RECOVERED MATERIALS STOCK */}
      {activeTab === "materials" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
              <input
                type="text"
                placeholder="Search material type, storage location, source batch..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
              />
            </div>
            <span className="text-xs font-mono text-[#6B7C74]">
              Showing {filteredMaterials.length} of {materials.length} material lots
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Material Lot ID</th>
                    <th className="p-3">Material Description</th>
                    <th className="p-3">Recovered Mass</th>
                    <th className="p-3">Claimed Mass</th>
                    <th className="p-3">Available Stock</th>
                    <th className="p-3">Purity (%)</th>
                    <th className="p-3">Storage Location</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#6B7C74] text-xs">
                        No recovered materials found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((m) => {
                      const availKg = Math.max(0, Number(((m.recoveredWeightKg || 0) - (m.claimedWeightKg || 0)).toFixed(2)));
                      return (
                        <tr key={m.id || m._id} className="hover:bg-[#F7FBF7]">
                          <td className="p-3 font-mono font-bold text-[#075B46]">{m.materialBatchId || m.id?.slice(0, 10)}</td>
                          <td className="p-3 text-[#173C32] font-semibold">{m.materialType}</td>
                          <td className="p-3 font-mono text-[#087F5B] font-bold">{m.recoveredWeightKg} kg</td>
                          <td className="p-3 font-mono text-indigo-600">{m.claimedWeightKg || 0} kg</td>
                          <td className="p-3 font-mono text-[#173C32] font-bold">{availKg} kg</td>
                          <td className="p-3 font-mono text-[#6B7C74]">{m.purityPercentage}%</td>
                          <td className="p-3 text-[#6B7C74] font-mono">{m.storageLocation || "Warehouse Bay 1"}</td>
                          <td className="p-3">
                            <Badge status={availKg > 0 ? "AVAILABLE" : "PROCESSED"} size="sm" />
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

      {/* TAB 4: REFURBISHED GOODS */}
      {activeTab === "refurb" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-serif text-[#173C32] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#087F5B]" />
                <span>Certified Refurbished Hardware Line</span>
              </h3>
              <p className="text-xs text-[#6B7C74] mt-1 font-sans">
                Register repaired, tested, and upgraded electronics with immutable serial numbers and warranties on-chain.
              </p>
            </div>
            <button
              onClick={() => setIsProductOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Register Refurbished Device</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: PROCESSING HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                <input
                  type="text"
                  placeholder="Search by Processing ID, Batch ID, Tx Hash..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
                />
              </div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
              >
                <option value="ALL">All Reconciliations</option>
                <option value="CONFIRMED">Balanced Only</option>
                <option value="DISPUTED">Imbalanced Only</option>
              </select>
            </div>
            <span className="text-xs font-mono text-[#6B7C74]">
              Showing {filteredHistory.length} of {processingRecords.length} runs
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Processing ID</th>
                    <th className="p-3">Source Batch</th>
                    <th className="p-3">Input Mass</th>
                    <th className="p-3">Total Recovered</th>
                    <th className="p-3">Residual / Loss</th>
                    <th className="p-3">Reconciliation</th>
                    <th className="p-3">Supervisor Status</th>
                    <th className="p-3">On-Chain Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5DB]">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#6B7C74] text-xs">
                        No processing records match search query.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((proc) => (
                      <tr key={proc.id} className="hover:bg-[#F7FBF7]">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{proc.processingId}</td>
                        <td className="p-3 font-mono text-[#173C32]">{proc.sourceBatch?.batchId}</td>
                        <td className="p-3 font-mono text-[#173C32] font-bold">{proc.inputWeightKg} kg</td>
                        <td className="p-3 font-mono text-[#087F5B] font-bold">{proc.totalRecoveredKg} kg</td>
                        <td className="p-3 font-mono text-[#6B7C74]">
                          {proc.residualKg} kg / {proc.documentedLossKg} kg
                        </td>
                        <td className="p-3">
                          <Badge status={proc.massBalanceValid ? "CONFIRMED" : "DISPUTED"} size="sm" />
                        </td>
                        <td className="p-3">
                          <Badge status={proc.supervisorApproved ? "VERIFIED" : "PENDING"} size="sm" />
                        </td>
                        <td className="p-3 font-mono text-[11px] text-[#6B7C74] truncate max-w-[120px]">
                          {proc.txHash || "0x5FbDB...80aa3"}
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

      {/* Processing & Mass Balance Modal */}
      {isProcessingOpen && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-modal relative space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif text-[#173C32] flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#087F5B]" />
                <span>Record E-Waste Recycling Run & Validate Mass-Balance</span>
              </h3>
              <button onClick={() => setIsProcessingOpen(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProcessing} className="space-y-4 text-xs">
              {/* Select Source Batch */}
              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Select Intake Batch for Processing</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => handleBatchSelectChange(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono focus:outline-none focus:border-[#087F5B]"
                >
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchId} — {b.category?.name} ({b.initialWeightKg} kg)
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Weight */}
              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Input Shredder Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={inputWeightKg}
                  onChange={(e) => setInputWeightKg(Number(e.target.value))}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] font-mono font-bold focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              {/* Dynamic Recovered Materials Table */}
              <div className="space-y-2 pt-2 border-t border-[#D7E5DB]">
                <div className="flex items-center justify-between">
                  <span className="text-[#173C32] font-bold uppercase tracking-wider text-[11px]">
                    Certified Recovered Fractions (Output)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMaterialRow}
                    className="text-[#087F5B] hover:text-[#075B46] font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Material Row</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {recoveredList.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#EDF7EF]/50 p-2.5 rounded-xl border border-[#D7E5DB]">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Material Type"
                          value={m.materialType}
                          onChange={(e) => handleMaterialChange(idx, "materialType", e.target.value)}
                          className="w-full bg-transparent text-[#173C32] font-medium focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="kg"
                          value={m.weightKg}
                          onChange={(e) => handleMaterialChange(idx, "weightKg", Number(e.target.value))}
                          className="w-full bg-transparent text-[#087F5B] font-mono font-bold focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Purity %"
                          value={m.purityPercentage}
                          onChange={(e) => handleMaterialChange(idx, "purityPercentage", Number(e.target.value))}
                          className="w-full bg-transparent text-[#173C32] font-mono focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Location"
                          value={m.location}
                          onChange={(e) => handleMaterialChange(idx, "location", e.target.value)}
                          className="w-full bg-transparent text-[#6B7C74] text-[11px] focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialRow(idx)}
                          className="text-[#6B7C74] hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Residual & Documented Loss */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#D7E5DB]">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Residual Slag / Non-Recyclable Waste (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={residualKg}
                    onChange={(e) => setResidualKg(Number(e.target.value))}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-amber-800 font-mono font-bold focus:outline-none focus:border-[#087F5B]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Documented Pyrometallurgical Loss (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={documentedLossKg}
                    onChange={(e) => setDocumentedLossKg(Number(e.target.value))}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-rose-700 font-mono font-bold focus:outline-none focus:border-[#087F5B]"
                  />
                </div>
              </div>

              {/* Live Mass-Balance Audit Status Indicator */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isMassBalanceValid
                    ? "bg-[#E5F5EA] border-[#087F5B]/30 text-[#075B46]"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <div>
                  <p className="font-bold">
                    {isMassBalanceValid
                      ? "✓ Mass-Balance Formula Perfectly Balanced"
                      : "✕ Mass-Balance Formula Imbalance"}
                  </p>
                  <p className="text-[11px] opacity-80">
                    Input ({inputWeightKg} kg) vs Output ({totalOutputKg} kg). Difference: {massBalanceDiff.toFixed(2)} kg
                  </p>
                </div>
                <span className="font-mono text-sm font-bold">
                  {isMassBalanceValid ? "RECONCILED" : "REJECTED"}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProcessingOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#173C32] font-medium border border-[#D7E5DB] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isMassBalanceValid || submitting}
                  className="px-5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold disabled:opacity-50 shadow-sm transition-all"
                >
                  {submitting ? "Signing On-Chain..." : "Record & Validate Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refurbished Product Registration Modal */}
      {isProductOpen && (
        <div className="fixed inset-0 z-50 bg-[#173C32]/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-modal relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
              <h3 className="text-base font-serif text-[#173C32] flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#087F5B]" />
                <span>Register Refurbished Electronic Device</span>
              </h3>
              <button onClick={() => setIsProductOpen(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Product Commercial Name</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Brand & Model</label>
                  <input
                    type="text"
                    required
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                  />
                </div>
                <div>
                  <label className="block text-[#173C32] mb-1 font-medium">Warranty Period</label>
                  <select
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                    className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                  >
                    <option value={6}>6 Months Warranty</option>
                    <option value={12}>12 Months Warranty</option>
                    <option value={24}>24 Months Warranty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Immutable Serial Number</label>
                <input
                  type="text"
                  required
                  value={prodSerial}
                  onChange={(e) => setProdSerial(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#087F5B] font-mono font-bold focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Refurbishment Condition</label>
                <select
                  value={prodCondition}
                  onChange={(e) => setProdCondition(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                >
                  <option value="Grade A - Certified Pristine">Grade A - Certified Pristine</option>
                  <option value="Grade B - Excellent Circular">Grade B - Excellent Circular</option>
                  <option value="Grade C - Fully Functional Refurbished">Grade C - Fully Functional Refurbished</option>
                </select>
              </div>

              <div>
                <label className="block text-[#173C32] mb-1 font-medium">Tested & Replaced Components</label>
                <textarea
                  rows={2}
                  value={replacedParts}
                  onChange={(e) => setReplacedParts(e.target.value)}
                  className="w-full bg-white border border-[#D7E5DB] rounded-xl px-3 py-2 text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#173C32] font-medium border border-[#D7E5DB] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold disabled:opacity-50 shadow-sm transition-all"
                >
                  {submitting ? "Signing On-Chain..." : "Register Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
