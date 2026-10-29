import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import {
  ShieldCheck,
  Recycle,
  Scale,
  Truck,
  AlertTriangle,
  Link2,
  FileSpreadsheet,
  FileText,
  Download,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Calendar,
  Filter,
  ExternalLink,
  RefreshCw,
  LayoutDashboard,
  Building2,
  ScrollText,
  Eye,
  Check,
  X,
  Battery,
  Tag,
  AlertCircle,
  MapPin,
  Smartphone,
  Laptop,
  CheckCircle,
  Package,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AdminUserManagementSection } from "../../components/admin/AdminUserManagementSection";

type TabType =
  | "overview"
  | "inspection"
  | "users"
  | "reports"
  | "claims"
  | "compliance"
  | "blockchain"
  | "audits";

export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<any | null>(null);
  const [blockchainTxs, setBlockchainTxs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Marketplace Inspection & Review State
  const [inspectionListings, setInspectionListings] = useState<any[]>([]);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState<string>("ALL");
  const [inspectionCategoryFilter, setInspectionCategoryFilter] = useState<string>("ALL");
  const [inspectionSearch, setInspectionSearch] = useState<string>("");
  const [inspectionStats, setInspectionStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED" | null>(null);

  // Excel Reporting & Date Filtering State
  const [exportingReport, setExportingReport] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Search & Filter States
  const [auditSearch, setAuditSearch] = useState<string>("");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("");
  const [txSearch, setTxSearch] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  // Sync tab with React Router location.hash
  useEffect(() => {
    const rawHash = location.hash.replace("#", "").toLowerCase() as TabType;
    if (
      [
        "overview",
        "inspection",
        "users",
        "reports",
        "claims",
        "compliance",
        "blockchain",
        "audits",
      ].includes(rawHash)
    ) {
      setActiveTab(rawHash);
    } else if (!rawHash) {
      setActiveTab("overview");
    }
  }, [location.hash]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [analyticsRes, txsRes, auditsRes, usersRes, inspectionRes] =
        await Promise.allSettled([
          api.getAdminAnalytics(),
          api.getBlockchainTxs(),
          api.getAuditLogs(),
          api.getUsers(),
          api.getInspectionListings({ limit: 100 }),
        ]);

      if (analyticsRes.status === "fulfilled" && analyticsRes.value?.success) {
        setAnalytics(analyticsRes.value.metrics);
      } else {
        // Fallback default metrics object so rendering never crashes
        setAnalytics((prev: any) => prev || {
          totalCollectedWeightKg: 0,
          totalBatches: 0,
          recoveryYield: 0,
          totalRecoveredKg: 0,
          totalResidualKg: 0,
          totalDocumentedLossKg: 0,
          totalInputProcessedKg: 0,
          duplicateClaimAttempts: 0,
          disputedShipments: 0,
          materialSummary: {},
          facilityCompliance: [],
        });
        if (analyticsRes.status === "rejected") {
          console.warn("Admin analytics fetch failed:", analyticsRes.reason);
        }
      }

      if (txsRes.status === "fulfilled" && txsRes.value?.success) {
        setBlockchainTxs(txsRes.value.transactions || []);
      }

      if (auditsRes.status === "fulfilled" && auditsRes.value?.success) {
        setAuditLogs(auditsRes.value.logs || []);
      }

      if (usersRes.status === "fulfilled" && usersRes.value?.success) {
        setUsersList(usersRes.value.users || []);
      }

      if (inspectionRes.status === "fulfilled" && inspectionRes.value?.success) {
        setInspectionListings(inspectionRes.value.data || []);
        if (inspectionRes.value.summary) {
          setInspectionStats(inspectionRes.value.summary);
        }
      }
    } catch (err: any) {
      console.error("Failed to load admin metrics:", err);
      setLoadError(err.message || "Failed to load complete admin dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchInspectionListings = async () => {
    setInspectionLoading(true);
    try {
      const res = await api.getInspectionListings({
        status: inspectionStatusFilter !== "ALL" ? inspectionStatusFilter : undefined,
        category: inspectionCategoryFilter !== "ALL" ? inspectionCategoryFilter : undefined,
        search: inspectionSearch || undefined,
        limit: 100,
      });
      if (res.success) {
        setInspectionListings(res.data || []);
        if (res.summary) {
          setInspectionStats(res.summary);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch inspection listings:", err);
    } finally {
      setInspectionLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`);
  };

  const handleDownloadExcel = async (reportType: string, label: string) => {
    setExportingReport(reportType);
    setExportError(null);
    setExportSuccess(null);
    try {
      await api.downloadExcelReport(reportType, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setExportSuccess(`Successfully exported ${label} (.xlsx)`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      setExportError(err.message || "Failed to download Excel report");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setExportingReport(null);
    }
  };

  const handleDownloadCsv = async () => {
    setExportingReport("csv");
    setExportError(null);
    setExportSuccess(null);
    try {
      await api.downloadCsvReport();
      setExportSuccess("Successfully exported Audit CSV");
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      setExportError(err.message || "Failed to download CSV");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setExportingReport(null);
    }
  };

  const handleDownloadWord = async () => {
    setExportingReport("word");
    setExportError(null);
    setExportSuccess(null);
    try {
      await api.downloadWordAuditReport();
      setExportSuccess("Successfully exported EcoTrace Audit Report (.docx)");
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      setExportError(err.message || "Failed to download Word document");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setExportingReport(null);
    }
  };

  const handleUserStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "APPROVED" ? "SUSPENDED" : "APPROVED";
    try {
      await api.updateUserStatus(userId, newStatus);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Review listing handler
  const handleReviewListing = async (
    listingId: string,
    decision: "APPROVED" | "REJECTED",
    notes?: string
  ) => {
    setReviewSubmitting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const res = await api.reviewListing(listingId, {
        decision,
        reviewNotes:
          notes ||
          (decision === "APPROVED"
            ? "Inspected and verified by National Council Administrator."
            : "Declined during technical inspection."),
      });
      if (res.success) {
        setExportSuccess(
          `Listing ${listingId} was successfully marked as ${decision === "APPROVED" ? "APPROVED" : "REJECTED"}.`
        );
        setTimeout(() => setExportSuccess(null), 4000);
        setSelectedListing(null);
        setReviewAction(null);
        setReviewNotes("");
        await fetchInspectionListings();
        await loadData();
      } else {
        setExportError(res.error || `Failed to review listing.`);
        setTimeout(() => setExportError(null), 5000);
      }
    } catch (err: any) {
      setExportError(err.message || `Failed to review listing.`);
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // If initial load in progress and no analytics loaded yet
  if (loading && !analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-[#075B46]/20 border-t-[#075B46] rounded-full animate-spin" />
        <p className="text-xs text-[#6B7C74] font-medium font-sans">
          Initializing Executive Tower &amp; Audit Data...
        </p>
      </div>
    );
  }

  // Safe chart data formatting
  const materialData = Object.entries(analytics?.materialSummary || {}).map(([key, val]: any) => ({
    name: key.length > 15 ? key.slice(0, 15) + "..." : key,
    recovered: val?.recoveredKg ?? 0,
    claimed: val?.claimedKg ?? 0,
  }));

  const massBalancePieData = [
    { name: "Recovered Output", value: analytics?.totalRecoveredKg ?? 0, color: "#10B981" },
    { name: "Residual Waste", value: analytics?.totalResidualKg ?? 0, color: "#F59E0B" },
    { name: "Documented Loss", value: analytics?.totalDocumentedLossKg ?? 0, color: "#F43F5E" },
  ];

  // Filtering logs
  const filteredAuditLogs = (auditLogs || []).filter((log) => {
    const matchesAction = !auditActionFilter || log.action === auditActionFilter;
    const matchesSearch =
      !auditSearch ||
      log.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.user?.fullName?.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.entityType?.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.entityId?.toLowerCase().includes(auditSearch.toLowerCase());
    return matchesAction && matchesSearch;
  });

  // Filtering txs
  const filteredTxs = (blockchainTxs || []).filter((tx) => {
    return (
      !txSearch ||
      tx.txHash?.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.eventType?.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.functionName?.toLowerCase().includes(txSearch.toLowerCase())
    );
  });

  // Filtering users
  const filteredUsers = (usersList || []).filter((u) => {
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    const matchesSearch =
      !userSearch ||
      u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.organization?.toLowerCase().includes(userSearch.toLowerCase());
    return matchesRole && matchesSearch;
  });

  // Filtered Inspection Listings
  const filteredInspectionListings = (inspectionListings || []).filter((item) => {
    const matchesStatus =
      inspectionStatusFilter === "ALL" ||
      item.status?.toUpperCase() === inspectionStatusFilter.toUpperCase();
    const matchesCategory =
      inspectionCategoryFilter === "ALL" ||
      item.category?.toUpperCase() === inspectionCategoryFilter.toUpperCase();
    const matchesSearch =
      !inspectionSearch ||
      item.title?.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
      item.brand?.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
      item.model?.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
      item.listingId?.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(inspectionSearch.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const pendingCount =
    inspectionStats.pending ||
    inspectionListings.filter((l) => l.status === "PENDING_INSPECTION").length;

  return (
    <ErrorBoundary fallbackTitle="Admin Portal Oversight Recovery">
      <div className="space-y-8">
        {/* Top Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-serif text-[#173C32]">
                Executive Audit &amp; Oversight Tower
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-semibold">
                National Council
              </span>
            </div>
            <p className="text-xs text-[#6B7C74] mt-1 font-sans">
              Real-time mass balance validation, duplicate-claim prevention logs, verified on-chain transactions, and customer device inspection reviews.
            </p>
          </div>

          {/* Action Controls & Fast Exports */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <Link
              to="/verify"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] font-semibold text-xs border border-[#D7E5DB] transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#075B46]" />
              <span>Public Verifier</span>
            </Link>

            <button
              onClick={() => handleDownloadExcel("complete", "Master Complete Audit Report")}
              disabled={exportingReport !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {exportingReport === "complete" ? "Generating Master .xlsx..." : "Master Audit (.xlsx)"}
              </span>
            </button>

            <button
              onClick={handleDownloadWord}
              disabled={exportingReport !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all"
              title="Download official Microsoft Word (.docx) audit document"
            >
              <FileText className="w-4 h-4 text-[#A3E635]" />
              <span>{exportingReport === "word" ? "Building .docx..." : "Audit Report (.docx)"}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              disabled={exportingReport !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] disabled:opacity-50 text-[#173C32] font-semibold text-xs border border-[#D7E5DB] shadow-sm transition-all"
            >
              <Download className="w-4 h-4 text-[#075B46]" />
              <span>{exportingReport === "csv" ? "Exporting CSV..." : "Export CSV"}</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] border border-[#D7E5DB] text-[#6B7C74] hover:text-[#173C32] transition-colors shadow-sm disabled:opacity-50"
              title="Refresh database metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Recoverable Load Error Banner */}
        {loadError && (
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Partial data loading notice: {loadError}. Cached or safe defaults are active.
              </span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors shadow-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Global Export Feedback Alerts */}
        {exportSuccess && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E5F5EA] border border-[#D7E5DB] text-[#075B46] text-xs font-semibold animate-fadeIn shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-[#075B46]" />
            <span>{exportSuccess}</span>
          </div>
        )}
        {exportError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-fadeIn shadow-sm">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>{exportError}</span>
          </div>
        )}

        {/* Metric Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Collected Weight"
            value={`${(analytics?.totalCollectedWeightKg ?? 0).toLocaleString()} kg`}
            subtitle={`${analytics?.totalBatches ?? 0} registered batches`}
            icon={Recycle}
            color="emerald"
          />
          <StatCard
            title="Overall Recovery Yield"
            value={`${analytics?.recoveryYield ?? 0}%`}
            subtitle={`${analytics?.totalRecoveredKg ?? 0} kg certified circular material`}
            icon={Scale}
            color="emerald"
          />
          <StatCard
            title="Duplicate Claim Alerts"
            value={analytics?.duplicateClaimAttempts ?? 0}
            subtitle="Attempts prevented by smart contracts"
            icon={AlertTriangle}
            color={(analytics?.duplicateClaimAttempts ?? 0) > 0 ? "amber" : "emerald"}
          />
          <StatCard
            title="Disputed Shipments"
            value={analytics?.disputedShipments ?? 0}
            subtitle="Weighing discrepancies flagged"
            icon={ShieldCheck}
            color={(analytics?.disputedShipments ?? 0) > 0 ? "rose" : "blue"}
          />
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-[#D7E5DB] pb-2 overflow-x-auto text-xs font-medium">
          {[
            { id: "overview", label: "Executive Tower & Analytics", icon: LayoutDashboard },
            {
              id: "inspection",
              label: `Marketplace Inspection (${pendingCount})`,
              icon: ShieldCheck,
              badgeColor: pendingCount > 0 ? "bg-amber-100 text-amber-800" : undefined,
            },
            { id: "users", label: `User Management & RBAC (${usersList.length})`, icon: Users },
            { id: "reports", label: "Excel & Audit Reports (.xlsx)", icon: FileSpreadsheet },
            { id: "claims", label: "Duplicate Claims & Integrity", icon: AlertTriangle },
            { id: "compliance", label: "Facility Compliance", icon: Building2 },
            { id: "blockchain", label: `Blockchain Ledger (${blockchainTxs.length})`, icon: Link2 },
            { id: "audits", label: `Audit Logs & Governance (${auditLogs.length})`, icon: ScrollText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-semibold shadow-sm"
                  : "text-[#6B7C74] hover:text-[#173C32] hover:bg-[#EDF7EF]"
              }`}
            >
              <tab.icon
                className={`w-3.5 h-3.5 ${
                  activeTab === tab.id ? "text-[#075B46]" : "text-[#6B7C74]"
                }`}
              />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab: Overview & Recharts */}
        {activeTab === "overview" && (
          <ErrorBoundary fallbackTitle="Overview Analytics Chart Section">
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mass Balance Breakdown Pie */}
                <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
                    <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                      <Scale className="w-4 h-4 text-[#075B46]" />
                      <span>Total Input Mass-Balance Breakdown</span>
                    </h3>
                    <span className="text-xs font-mono text-[#075B46] font-semibold">
                      {analytics?.totalInputProcessedKg ?? 0} kg Processed
                    </span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={massBalancePieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) =>
                            `${name} (${(Number(percent || 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {massBalancePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => `${val} kg`}
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#D7E5DB",
                            color: "#173C32",
                            borderRadius: "12px",
                            boxShadow: "0 4px 12px rgba(7, 91, 70, 0.08)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recovered Materials Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB]">
                    <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#075B46]" />
                      <span>Recovered vs Claimed Materials (kg)</span>
                    </h3>
                  </div>
                  <div className="h-64">
                    {materialData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={materialData}>
                          <XAxis dataKey="name" stroke="#6B7C74" fontSize={11} />
                          <YAxis stroke="#6B7C74" fontSize={11} />
                          <Tooltip
                            formatter={(val: any) => `${val} kg`}
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              borderColor: "#D7E5DB",
                              color: "#173C32",
                              borderRadius: "12px",
                              boxShadow: "0 4px 12px rgba(7, 91, 70, 0.08)",
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="recovered"
                            name="Recovered (kg)"
                            fill="#075B46"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="claimed"
                            name="Claimed (kg)"
                            fill="#087F5B"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#6B7C74]">
                        No material records available yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Tab: Marketplace Inspection & Device Review Workflow */}
        {activeTab === "inspection" && (
          <ErrorBoundary fallbackTitle="Marketplace Inspection Review Center">
            <div className="space-y-6">
              {/* Inspection Summary Stats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-[#D7E5DB] shadow-sm flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-[#6B7C74] font-medium">
                      Pending Inspection
                    </p>
                    <p className="text-xl font-serif font-bold text-[#173C32]">
                      {inspectionStats.pending}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-[#D7E5DB] shadow-sm flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB]">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-[#6B7C74] font-medium">
                      Verified &amp; Approved
                    </p>
                    <p className="text-xl font-serif font-bold text-[#173C32]">
                      {inspectionStats.approved}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-[#D7E5DB] shadow-sm flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-[#6B7C74] font-medium">
                      Declined Submissions
                    </p>
                    <p className="text-xl font-serif font-bold text-[#173C32]">
                      {inspectionStats.rejected}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-[#D7E5DB] shadow-sm flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB]">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-[#6B7C74] font-medium">
                      Total Devices Ingested
                    </p>
                    <p className="text-xl font-serif font-bold text-[#173C32]">
                      {inspectionStats.total || inspectionListings.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Inspection Filter & Search Controls */}
              <div className="bg-white p-5 rounded-2xl border border-[#D7E5DB] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#075B46]" />
                    <span>Customer Device Inspection &amp; Technical Verification Queue</span>
                  </h3>
                  <p className="text-xs text-[#6B7C74] mt-0.5 font-sans">
                    Inspect submitted device descriptions, battery diagnostics, specifications, and verify listings for the P2P Marketplace.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Status Filter */}
                  <select
                    value={inspectionStatusFilter}
                    onChange={(e) => setInspectionStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] font-medium shadow-sm focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_INSPECTION">Pending Inspection</option>
                    <option value="APPROVED">Approved / Listed</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="SOLD">Sold</option>
                  </select>

                  {/* Category Filter */}
                  <select
                    value={inspectionCategoryFilter}
                    onChange={(e) => setInspectionCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] font-medium shadow-sm focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="SMARTPHONE">Smartphones</option>
                    <option value="LAPTOP">Laptops</option>
                    <option value="TABLET">Tablets</option>
                    <option value="MONITOR">Monitors</option>
                    <option value="AUDIO">Audio Devices</option>
                    <option value="OTHER">Other Electronics</option>
                  </select>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                    <input
                      type="text"
                      placeholder="Search title, brand, description..."
                      value={inspectionSearch}
                      onChange={(e) => setInspectionSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74]/60 focus:outline-none focus:border-[#075B46] w-48 sm:w-56 shadow-sm"
                    />
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={fetchInspectionListings}
                    disabled={inspectionLoading}
                    className="p-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] border border-[#D7E5DB] text-[#075B46] transition-colors shadow-sm disabled:opacity-50"
                    title="Refresh inspection list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${inspectionLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Listings Queue Table */}
              <div className="bg-white rounded-2xl border border-[#D7E5DB] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-3.5">Device Details</th>
                        <th className="p-3.5">Category &amp; Specs</th>
                        <th className="p-3.5">Description</th>
                        <th className="p-3.5">Condition &amp; Battery</th>
                        <th className="p-3.5">Expected Price</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7E5DB]">
                      {filteredInspectionListings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-xs text-[#6B7C74]">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <ShieldCheck className="w-8 h-8 text-[#075B46]/40" />
                              <p className="font-semibold text-[#173C32]">No device submissions found</p>
                              <p className="text-[11px] text-[#6B7C74]">
                                All customer submissions matching the filter criteria have been inspected.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredInspectionListings.map((listing: any) => {
                          const isPending = listing.status === "PENDING_INSPECTION";
                          const battery = listing.batteryInfo;
                          return (
                            <tr key={listing.id || listing.listingId} className="hover:bg-[#F7FBF7]">
                              {/* Device Details */}
                              <td className="p-3.5">
                                <div className="space-y-0.5">
                                  <span className="font-serif font-bold text-sm text-[#173C32] block">
                                    {listing.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B7C74]">
                                    <span className="font-medium text-[#173C32]">{listing.brand}</span>
                                    <span>•</span>
                                    <span>{listing.model}</span>
                                    <span>•</span>
                                    <span>{listing.ageYears ? `${listing.ageYears} yr old` : "Age N/A"}</span>
                                  </div>
                                  <span className="font-mono text-[10px] text-[#075B46] block">
                                    ID: {listing.listingId}
                                  </span>
                                </div>
                              </td>

                              {/* Category */}
                              <td className="p-3.5">
                                <div className="space-y-1">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB] inline-block">
                                    {listing.category}
                                  </span>
                                  <span className="text-[11px] text-[#6B7C74] block">
                                    {listing.customerName ? `From ${listing.customerName}` : "Customer"}
                                  </span>
                                  {listing.approximateLocation && (
                                    <span className="text-[10px] text-[#6B7C74] flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-[#075B46]" />
                                      <span>{listing.approximateLocation}</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Description Preview */}
                              <td className="p-3.5 max-w-xs">
                                <div className="space-y-1">
                                  <p
                                    className="text-xs text-[#173C32] font-sans line-clamp-2"
                                    title={listing.description}
                                  >
                                    {listing.description || (
                                      <span className="italic text-[#6B7C74]">
                                        No description provided.
                                      </span>
                                    )}
                                  </p>
                                  {listing.damageDetails && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block font-sans">
                                      Defect note: {listing.damageDetails}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Condition & Battery */}
                              <td className="p-3.5">
                                <div className="space-y-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold inline-block ${
                                      listing.condition === "WORKING"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : listing.condition === "PARTIALLY_WORKING"
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {listing.condition || "WORKING"}
                                  </span>
                                  {battery && (
                                    <div className="flex items-center gap-1 text-[11px] text-[#173C32]">
                                      <Battery className="w-3.5 h-3.5 text-[#075B46]" />
                                      <span className="font-mono font-semibold">
                                        {battery.maxCapacityPercent ?? 85}%
                                      </span>
                                      <span className="text-[10px] text-[#6B7C74]">
                                        ({battery.healthState || "GOOD"})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Expected Price */}
                              <td className="p-3.5 font-mono text-xs">
                                <span className="font-bold text-[#075B46]">
                                  ₹{(listing.expectedPrice ?? 0).toLocaleString()}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold inline-flex items-center gap-1 ${
                                    listing.status === "APPROVED" || listing.status === "LISTED"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : listing.status === "PENDING_INSPECTION"
                                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                                      : listing.status === "REJECTED"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-gray-100 text-gray-700 border border-gray-200"
                                  }`}
                                >
                                  {listing.status === "PENDING_INSPECTION" && (
                                    <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  )}
                                  {listing.status === "APPROVED" && (
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  )}
                                  {listing.status === "REJECTED" && (
                                    <XCircle className="w-2.5 h-2.5 text-rose-600" />
                                  )}
                                  <span>{listing.status}</span>
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="p-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedListing(listing)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] text-xs font-semibold border border-[#D7E5DB] transition-all shadow-sm"
                                    title="View full device specifications and customer description"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Inspect</span>
                                  </button>

                                  {isPending && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setSelectedListing(listing);
                                          setReviewAction("APPROVED");
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all"
                                        title="Approve device for marketplace"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedListing(listing);
                                          setReviewAction("REJECTED");
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all shadow-sm"
                                        title="Reject submission"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
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

              {/* Full Device Inspection Details Modal */}
              {selectedListing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                  <div className="bg-white rounded-3xl border border-[#D7E5DB] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
                    {/* Modal Header */}
                    <div className="flex items-start justify-between pb-4 border-b border-[#D7E5DB]">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-serif font-bold text-[#173C32]">
                            {selectedListing.title}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                              selectedListing.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : selectedListing.status === "PENDING_INSPECTION"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {selectedListing.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7C74] font-mono mt-0.5">
                          Listing ID: {selectedListing.listingId} • Submitted:{" "}
                          {new Date(selectedListing.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedListing(null);
                          setReviewAction(null);
                          setReviewNotes("");
                        }}
                        className="p-1.5 rounded-full hover:bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Prominent Customer General Description */}
                    <div className="bg-[#F7FBF7] p-5 rounded-2xl border border-[#D7E5DB] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-serif font-bold text-[#173C32] flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#075B46]" />
                          <span>Customer Product Description</span>
                        </span>
                        <span className="text-[10px] font-mono bg-[#E5F5EA] text-[#075B46] px-2 py-0.5 rounded-full font-semibold border border-[#D7E5DB]">
                          Verified Valid
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-[#D7E5DB]">
                        <p className="text-xs text-[#173C32] font-sans leading-relaxed whitespace-pre-wrap">
                          {selectedListing.description || "No general description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Hardware Specifications Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-[#EDF7EF]/50 p-3 rounded-xl border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block font-mono uppercase">
                          Brand &amp; Model
                        </span>
                        <span className="text-xs font-semibold text-[#173C32] block mt-0.5">
                          {selectedListing.brand} {selectedListing.model}
                        </span>
                      </div>

                      <div className="bg-[#EDF7EF]/50 p-3 rounded-xl border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block font-mono uppercase">
                          Category
                        </span>
                        <span className="text-xs font-semibold text-[#075B46] block mt-0.5">
                          {selectedListing.category}
                        </span>
                      </div>

                      <div className="bg-[#EDF7EF]/50 p-3 rounded-xl border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block font-mono uppercase">
                          Device Age
                        </span>
                        <span className="text-xs font-semibold text-[#173C32] block mt-0.5">
                          {selectedListing.ageYears} {selectedListing.ageYears === 1 ? "year" : "years"}
                        </span>
                      </div>

                      <div className="bg-[#EDF7EF]/50 p-3 rounded-xl border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block font-mono uppercase">
                          Declared Condition
                        </span>
                        <span className="text-xs font-semibold text-[#173C32] block mt-0.5">
                          {selectedListing.condition}
                        </span>
                      </div>

                      <div className="bg-[#EDF7EF]/50 p-3 rounded-xl border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block font-mono uppercase">
                          Expected Payout
                        </span>
                        <span className="text-xs font-bold text-[#075B46] block mt-0.5">
                          ₹{(selectedListing.expectedPrice ?? 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="bg-[#EDF7EF]/50 p-3 rounded-xl border border-[#D7E5DB]">
                        <span className="text-[10px] text-[#6B7C74] block font-mono uppercase">
                          Seller Details
                        </span>
                        <span className="text-xs font-semibold text-[#173C32] block mt-0.5 truncate">
                          {selectedListing.customerName}
                        </span>
                      </div>
                    </div>

                    {/* Battery Diagnostics Section */}
                    {selectedListing.batteryInfo && (
                      <div className="bg-white p-4 rounded-2xl border border-[#D7E5DB] space-y-2">
                        <h4 className="text-xs font-serif font-bold text-[#173C32] flex items-center gap-1.5">
                          <Battery className="w-4 h-4 text-[#075B46]" />
                          <span>Battery Assessment &amp; Degradation Diagnostic</span>
                        </h4>
                        <div className="grid grid-cols-3 gap-3 pt-1">
                          <div className="p-2.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB]">
                            <span className="text-[10px] text-[#6B7C74] block">Max Capacity</span>
                            <span className="text-xs font-mono font-bold text-[#075B46]">
                              {selectedListing.batteryInfo.maxCapacityPercent ?? 85}%
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB]">
                            <span className="text-[10px] text-[#6B7C74] block">Health Rating</span>
                            <span className="text-xs font-mono font-bold text-[#173C32]">
                              {selectedListing.batteryInfo.healthState || "GOOD"}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB]">
                            <span className="text-[10px] text-[#6B7C74] block">Cycle Count</span>
                            <span className="text-xs font-mono font-bold text-[#173C32]">
                              {selectedListing.batteryInfo.cycleCount ?? "N/A"}
                            </span>
                          </div>
                        </div>
                        {selectedListing.batteryInfo.batteryNotes && (
                          <p className="text-[11px] text-[#6B7C74] italic">
                            Diagnostic note: {selectedListing.batteryInfo.batteryNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Defect or Damage Assessment */}
                    {selectedListing.damageDetails && (
                      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-1">
                        <span className="text-xs font-serif font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Customer-Reported Damage &amp; Functional Imperfections</span>
                        </span>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          {selectedListing.damageDetails}
                        </p>
                      </div>
                    )}

                    {/* Existing Review Notes (if already inspected) */}
                    {selectedListing.reviewNotes && (
                      <div className="bg-[#EDF7EF] p-4 rounded-2xl border border-[#D7E5DB] space-y-1">
                        <span className="text-xs font-serif font-bold text-[#173C32]">
                          Recorded Inspector Audit Notes:
                        </span>
                        <p className="text-xs text-[#075B46]">{selectedListing.reviewNotes}</p>
                      </div>
                    )}

                    {/* Review Decision Input Form */}
                    <div className="pt-2 border-t border-[#D7E5DB] space-y-3">
                      <label className="text-xs font-serif font-bold text-[#173C32] block">
                        Inspection Review Notes (Optional / Required on Reject):
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Enter technical comments, grading observations, or rejection criteria..."
                        rows={2}
                        className="w-full p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46] shadow-sm"
                      />

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedListing(null);
                            setReviewAction(null);
                            setReviewNotes("");
                          }}
                          className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-xs font-semibold text-[#6B7C74] hover:bg-[#EDF7EF] transition-all"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={reviewSubmitting}
                          onClick={() =>
                            handleReviewListing(
                              selectedListing.listingId || selectedListing.id,
                              "REJECTED",
                              reviewNotes
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all shadow-sm disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject Listing</span>
                        </button>

                        <button
                          type="button"
                          disabled={reviewSubmitting}
                          onClick={() =>
                            handleReviewListing(
                              selectedListing.listingId || selectedListing.id,
                              "APPROVED",
                              reviewNotes
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {reviewSubmitting ? "Submitting..." : "Approve & Verify Listing"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        {/* Tab: User Management & RBAC */}
        {activeTab === "users" && (
          <ErrorBoundary fallbackTitle="Admin User Governance Section">
            <AdminUserManagementSection />
          </ErrorBoundary>
        )}

        {/* Tab: Dedicated Excel Reports Center */}
        {activeTab === "reports" && (
          <ErrorBoundary fallbackTitle="Excel & Word Reports Section">
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="bg-white p-5 rounded-2xl border border-[#D7E5DB] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#075B46]" />
                    <span>Audit Workbooks &amp; Regulatory Excel Export Center</span>
                  </h3>
                  <p className="text-xs text-[#6B7C74] mt-0.5 font-sans">
                    Generate official .xlsx spreadsheets directly from MongoDB records and Hardhat blockchain state.
                  </p>
                </div>

                {/* Date Range Picker */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-[#EDF7EF] px-3 py-1.5 rounded-xl border border-[#D7E5DB]">
                    <Calendar className="w-3.5 h-3.5 text-[#6B7C74]" />
                    <span className="text-[#6B7C74] font-medium">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-[#173C32] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#EDF7EF] px-3 py-1.5 rounded-xl border border-[#D7E5DB]">
                    <Calendar className="w-3.5 h-3.5 text-[#6B7C74]" />
                    <span className="text-[#6B7C74] font-medium">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-[#173C32] focus:outline-none"
                    />
                  </div>

                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#EDF7EF] text-[#6B7C74] hover:text-[#173C32] border border-[#D7E5DB]"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Featured Official Microsoft Word (.docx) Audit Report */}
              <div className="bg-gradient-to-r from-[#EDF7EF] via-[#F4F9F6] to-[#E5F5EA] p-5 rounded-2xl border border-[#D7E5DB] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-xl bg-[#075B46] text-white shrink-0 shadow-sm">
                    <FileText className="w-5 h-5 text-[#A3E635]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-serif font-bold text-[#173C32]">
                        Official Microsoft Word Audit Report (.docx)
                      </h4>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#075B46] text-white">
                        Genuine .docx
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7C74] mt-1 font-sans">
                      Comprehensive compliance report in genuine Microsoft Word format with executive KPI summary, chronological system audit events, mass-balance verification, and immutable blockchain batch records.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadWord}
                  disabled={exportingReport !== null}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap self-stretch md:self-auto justify-center"
                >
                  <FileText className="w-4 h-4 text-[#A3E635]" />
                  <span>{exportingReport === "word" ? "Generating .docx..." : "Download Word (.docx)"}</span>
                </button>
              </div>

              {/* 8 Required Excel Workbooks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    id: "complete",
                    title: "Complete Master Audit",
                    desc: "Multi-sheet workbook: Executive KPI summary, collections, shipments, mass-balance, materials, claims, and blockchain trail.",
                    badge: "Full Suite",
                  },
                  {
                    id: "collection",
                    title: "E-Waste Collections",
                    desc: "Batch registers, category splits, initial weights, pickup locations, dealer contact info, and registration hashes.",
                    badge: "Intake",
                  },
                  {
                    id: "shipment",
                    title: "Shipments & Logistics",
                    desc: "Transporter manifests, vehicle plates, origin-to-hub routes, pickup vs delivered weights, and transit exceptions.",
                    badge: "Logistics",
                  },
                  {
                    id: "recycling",
                    title: "Recycling & Mass-Balance",
                    desc: "Smelting inputs, recovered outputs, process loss, residual landfill waste, variance, and yield calculations.",
                    badge: "Operations",
                  },
                  {
                    id: "materials",
                    title: "Material Stock & Claims",
                    desc: "Vault stock levels for refined metals, purity percentages, and verified customer circularity claims.",
                    badge: "Circularity",
                  },
                  {
                    id: "blockchain",
                    title: "Blockchain Ledger",
                    desc: "Immutable EVM transaction records, block numbers, gas usage, and verification hashes on Chain 31337.",
                    badge: "Ledger",
                  },
                  {
                    id: "users",
                    title: "User Activity & Accounts",
                    desc: "User directory with assigned roles, organization details, account approval states, and security audit logs.",
                    badge: "Security",
                  },
                  {
                    id: "compliance",
                    title: "Compliance & Disputes",
                    desc: "Facility compliance ratings, weighbridge discrepancies, dispute reasons, and audit investigations.",
                    badge: "Auditing",
                  },
                ].map((rep) => {
                  const isExporting = exportingReport === rep.id;
                  return (
                    <div
                      key={rep.id}
                      className="bg-white p-5 rounded-2xl border border-[#D7E5DB] flex flex-col justify-between hover:border-[#075B46]/40 transition-all group shadow-sm hover:shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="p-2.5 rounded-xl bg-[#E5F5EA] border border-[#D7E5DB] text-[#075B46] group-hover:scale-105 transition-transform shadow-sm">
                            <FileSpreadsheet className="w-5 h-5" />
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB]">
                            {rep.badge}
                          </span>
                        </div>
                        <h4 className="text-sm font-serif font-bold text-[#173C32] group-hover:text-[#075B46] transition-colors">
                          {rep.title}
                        </h4>
                        <p className="text-xs text-[#6B7C74] leading-relaxed font-sans">{rep.desc}</p>
                      </div>

                      <div className="pt-4 border-t border-[#D7E5DB] mt-4 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#075B46] font-semibold">
                          .XLSX WORKBOOK
                        </span>
                        <button
                          onClick={() => handleDownloadExcel(rep.id, rep.title)}
                          disabled={exportingReport !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isExporting ? "Building..." : "Download"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Tab: Duplicate Claims */}
        {activeTab === "claims" && (
          <ErrorBoundary fallbackTitle="Duplicate Claims Integrity Section">
            <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#D7E5DB]">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#173C32]">
                    Duplicate Recovery-Claim Prevention System
                  </h3>
                  <p className="text-xs text-[#6B7C74]">
                    Audited recovery claims and blocked over-allocation attempts.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] shadow-sm">
                  Double-Count Protection: Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Material Type</th>
                      <th className="p-3">Total Recovered</th>
                      <th className="p-3">Total Claimed</th>
                      <th className="p-3">Unallocated Remaining</th>
                      <th className="p-3">Claim Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB]">
                    {Object.entries(analytics?.materialSummary || {}).map(([key, val]: any) => {
                      const recoveredKg = val?.recoveredKg ?? 0;
                      const claimedKg = val?.claimedKg ?? 0;
                      const remaining = Number((recoveredKg - claimedKg).toFixed(2));
                      return (
                        <tr key={key} className="hover:bg-[#F7FBF7]">
                          <td className="p-3 font-semibold text-[#173C32]">{key}</td>
                          <td className="p-3 font-mono text-[#075B46] font-bold">{recoveredKg} kg</td>
                          <td className="p-3 font-mono text-[#087F5B]">{claimedKg} kg</td>
                          <td className="p-3 font-mono text-[#173C32]">{remaining} kg</td>
                          <td className="p-3">
                            <Badge status={remaining >= 0 ? "VERIFIED" : "DISPUTED"} size="sm" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Tab: Facility Compliance */}
        {activeTab === "compliance" && (
          <ErrorBoundary fallbackTitle="Facility Compliance Audit Section">
            <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
              <h3 className="text-sm font-serif font-bold text-[#173C32]">
                Facility Compliance &amp; Discrepancy Audits
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Facility Name</th>
                      <th className="p-3">Facility Code</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Receivings</th>
                      <th className="p-3">Weighing Disputes</th>
                      <th className="p-3">Compliance Score</th>
                      <th className="p-3">Authorization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB]">
                    {(analytics?.facilityCompliance || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-xs text-[#6B7C74]">
                          No facility compliance records logged.
                        </td>
                      </tr>
                    ) : (
                      (analytics?.facilityCompliance || []).map((fac: any) => (
                        <tr key={fac.id || fac.code} className="hover:bg-[#F7FBF7]">
                          <td className="p-3 font-semibold text-[#173C32]">{fac.name}</td>
                          <td className="p-3 font-mono text-[#6B7C74]">{fac.code}</td>
                          <td className="p-3 text-[#6B7C74]">{fac.type}</td>
                          <td className="p-3 font-mono text-[#173C32]">{fac.totalReceivings}</td>
                          <td className="p-3 font-mono text-rose-600 font-semibold">{fac.disputes}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-[#EDF7EF] rounded-full overflow-hidden border border-[#D7E5DB]">
                                <div
                                  style={{ width: `${fac.complianceScore}%` }}
                                  className={`h-full ${
                                    fac.complianceScore >= 90 ? "bg-[#075B46]" : "bg-amber-500"
                                  }`}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-bold text-[#173C32]">
                                {fac.complianceScore}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge status={fac.authorized ? "CONFIRMED" : "PENDING"} size="sm" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Tab: Blockchain Ledger */}
        {activeTab === "blockchain" && (
          <ErrorBoundary fallbackTitle="Blockchain Ledger Records Section">
            <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#D7E5DB] gap-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-[#075B46]" />
                    <span>On-Chain EVM Transactions (Chain ID: 31337)</span>
                  </h3>
                  <p className="text-xs text-[#6B7C74]">
                    Immutable records committed to the EWasteRegistry contract (0x5FbDB...80aa3).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                    <input
                      type="text"
                      placeholder="Search Tx Hash or Event..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74]/60 focus:outline-none focus:border-[#075B46] w-52 shadow-sm"
                    />
                  </div>
                  <span className="font-mono text-xs text-[#075B46] font-semibold whitespace-nowrap">
                    {filteredTxs.length} Transactions
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Tx Hash</th>
                      <th className="p-3">Contract Function</th>
                      <th className="p-3">Block No</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB] font-mono">
                    {filteredTxs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-xs text-[#6B7C74] font-sans">
                          No blockchain transactions matching query.
                        </td>
                      </tr>
                    ) : (
                      filteredTxs.map((tx: any) => (
                        <tr key={tx.id || tx.txHash} className="hover:bg-[#F7FBF7]">
                          <td className="p-3 text-[#075B46] font-bold truncate max-w-xs">{tx.txHash}</td>
                          <td className="p-3 text-[#173C32] font-sans font-semibold">
                            {tx.functionName || tx.eventType}
                          </td>
                          <td className="p-3 text-[#6B7C74]">{tx.blockNumber ?? "Pending"}</td>
                          <td className="p-3">
                            <Badge status={tx.status} size="sm" />
                          </td>
                          <td className="p-3 text-[#6B7C74] text-[11px] font-sans">
                            {new Date(tx.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Tab: Audit Logs & User Accounts */}
        {activeTab === "audits" && (
          <ErrorBoundary fallbackTitle="Audit Logs Governance Section">
            <div className="space-y-6">
              {/* User Account Controls */}
              <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#D7E5DB]">
                  <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#075B46]" />
                    <span>User &amp; Role Governance</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] shadow-sm"
                    >
                      <option value="">All Roles</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="DEALER">DEALER</option>
                      <option value="DRIVER">DRIVER</option>
                      <option value="FACTORY">FACTORY</option>
                      <option value="WORKER">WORKER</option>
                      <option value="CUSTOMER">CUSTOMER</option>
                    </select>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                      <input
                        type="text"
                        placeholder="Search name, email..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74]/60 focus:outline-none focus:border-[#075B46] w-44 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-3">Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Facility / Org</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7E5DB]">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-xs text-[#6B7C74]">
                            No users found matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u: any) => (
                          <tr key={u.id} className="hover:bg-[#F7FBF7]">
                            <td className="p-3 font-semibold text-[#173C32]">{u.fullName}</td>
                            <td className="p-3 text-[#6B7C74] font-mono">{u.email}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB]">
                                {u.role}
                              </span>
                            </td>
                            <td className="p-3 text-[#6B7C74]">{u.facility?.name || u.organization || "—"}</td>
                            <td className="p-3">
                              <Badge status={u.status} size="sm" />
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => handleUserStatusToggle(u.id, u.status)}
                                className={`px-3 py-1 rounded-xl text-[11px] font-semibold border transition-colors shadow-sm ${
                                  u.status === "APPROVED"
                                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                    : "bg-[#E5F5EA] text-[#075B46] border-[#D7E5DB] hover:bg-[#EDF7EF]"
                                }`}
                              >
                                {u.status === "APPROVED" ? "Suspend" : "Approve"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chronological Audit Logs */}
              <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#D7E5DB]">
                  <h3 className="text-sm font-serif font-bold text-[#173C32] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#075B46]" />
                    <span>Immutable System Audit Trail</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                      <input
                        type="text"
                        placeholder="Search action or entity..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74]/60 focus:outline-none focus:border-[#075B46] w-52 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Actor</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Entity</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7E5DB]">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-xs text-[#6B7C74]">
                            No audit events matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-[#F7FBF7]">
                            <td className="p-3 text-[#6B7C74] text-[11px] font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3 text-[#173C32] font-semibold">
                              {log.user?.fullName || "System Engine"}
                            </td>
                            <td className="p-3 font-mono text-[#075B46] font-bold">{log.action}</td>
                            <td className="p-3 font-mono text-[#173C32]">
                              {log.entityType} ({log.entityId})
                            </td>
                            <td className="p-3 text-[#6B7C74] truncate max-w-xs">
                              {typeof log.details === "object"
                                ? JSON.stringify(log.details)
                                : log.details || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
};
