import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  ShieldCheck,
  Recycle,
  Scale,
  Truck,
  AlertTriangle,
  Link2,
  FileSpreadsheet,
  Download,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
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

export const AdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [blockchainTxs, setBlockchainTxs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "claims" | "compliance" | "blockchain" | "audits">("overview");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, txsRes, auditsRes, usersRes] = await Promise.all([
        api.getAdminAnalytics(),
        api.getBlockchainTxs(),
        api.getAuditLogs(),
        api.getUsers(),
      ]);

      if (analyticsRes.success) setAnalytics(analyticsRes.metrics);
      if (txsRes.success) setBlockchainTxs(txsRes.transactions);
      if (auditsRes.success) setAuditLogs(auditsRes.logs);
      if (usersRes.success) setUsersList(usersRes.users);
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
    } finally {
      setLoading(false);
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

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Chart data formatting
  const materialData = Object.entries(analytics.materialSummary || {}).map(([key, val]: any) => ({
    name: key.length > 15 ? key.slice(0, 15) + "..." : key,
    recovered: val.recoveredKg,
    claimed: val.claimedKg,
  }));

  const massBalancePieData = [
    { name: "Recovered Output", value: analytics.totalRecoveredKg, color: "#10B981" },
    { name: "Residual Waste", value: analytics.totalResidualKg, color: "#F59E0B" },
    { name: "Documented Loss", value: analytics.totalDocumentedLossKg, color: "#F43F5E" },
  ];

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Executive Audit & Oversight Tower</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
              National Council
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time mass balance validation, duplicate-claim prevention logs, and verified on-chain transactions.
          </p>
        </div>

        {/* CSV Export Button */}
        <a
          href={api.getExportCsvUrl()}
          download="ecotrace-audit-export.csv"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 shadow-md transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Audit CSV</span>
        </a>
      </div>

      {/* Metric Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Collected Weight"
          value={`${analytics.totalCollectedWeightKg.toLocaleString()} kg`}
          subtitle={`${analytics.totalBatches} registered batches`}
          icon={Recycle}
          color="emerald"
        />
        <StatCard
          title="Overall Recovery Yield"
          value={`${analytics.recoveryYield}%`}
          subtitle={`${analytics.totalRecoveredKg} kg certified circular material`}
          icon={Scale}
          color="emerald"
        />
        <StatCard
          title="Duplicate Claim Alerts"
          value={analytics.duplicateClaimAttempts}
          subtitle="Attempts prevented by smart contracts"
          icon={AlertTriangle}
          color={analytics.duplicateClaimAttempts > 0 ? "amber" : "emerald"}
        />
        <StatCard
          title="Disputed Shipments"
          value={analytics.disputedShipments}
          subtitle="Weighing discrepancies flagged"
          icon={ShieldCheck}
          color={analytics.disputedShipments > 0 ? "rose" : "blue"}
        />
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: "overview", label: "Analytics & Reconciliation" },
          { id: "claims", label: "Duplicate Claims & Integrity" },
          { id: "compliance", label: "Facility Compliance" },
          { id: "blockchain", label: "Blockchain Ledger (EVM 31337)" },
          { id: "audits", label: "Audit Logs & Accounts" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Recharts */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mass Balance Breakdown Pie */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>Total Input Mass-Balance Breakdown</span>
                </h3>
                <span className="text-xs font-mono text-emerald-400">
                  {analytics.totalInputProcessedKg} kg Processed
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
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {massBalancePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => `${val} kg`}
                      contentStyle={{ backgroundColor: "#111827", borderColor: "#1F2937", borderRadius: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recovered Materials Bar Chart */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Recovered vs Claimed Materials (kg)</span>
                </h3>
              </div>
              <div className="h-64">
                {materialData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={materialData}>
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                      <YAxis stroke="#94A3B8" fontSize={11} />
                      <Tooltip
                        formatter={(val: any) => `${val} kg`}
                        contentStyle={{ backgroundColor: "#111827", borderColor: "#1F2937", borderRadius: "8px" }}
                      />
                      <Legend />
                      <Bar dataKey="recovered" name="Recovered (kg)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="claimed" name="Claimed (kg)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No material records available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Duplicate Claims */}
      {activeTab === "claims" && (
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Duplicate Recovery-Claim Prevention System</h3>
              <p className="text-xs text-slate-400">
                Audited recovery claims and blocked over-allocation attempts.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Double-Count Protection: Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Material Type</th>
                  <th className="p-3">Total Recovered</th>
                  <th className="p-3">Total Claimed</th>
                  <th className="p-3">Unallocated Remaining</th>
                  <th className="p-3">Claim Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {Object.entries(analytics.materialSummary || {}).map(([key, val]: any) => {
                  const remaining = Number((val.recoveredKg - val.claimedKg).toFixed(2));
                  return (
                    <tr key={key} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{key}</td>
                      <td className="p-3 font-mono text-emerald-400">{val.recoveredKg} kg</td>
                      <td className="p-3 font-mono text-indigo-400">{val.claimedKg} kg</td>
                      <td className="p-3 font-mono text-slate-300">{remaining} kg</td>
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
      )}

      {/* Tab 3: Facility Compliance */}
      {activeTab === "compliance" && (
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Facility Compliance & Discrepancy Audits</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
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
              <tbody className="divide-y divide-slate-800">
                {analytics.facilityCompliance.map((fac: any) => (
                  <tr key={fac.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{fac.name}</td>
                    <td className="p-3 font-mono text-slate-400">{fac.code}</td>
                    <td className="p-3 text-slate-300">{fac.type}</td>
                    <td className="p-3 font-mono">{fac.totalReceivings}</td>
                    <td className="p-3 font-mono text-rose-400">{fac.disputes}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${fac.complianceScore}%` }}
                            className={`h-full ${fac.complianceScore >= 90 ? "bg-emerald-500" : "bg-amber-500"}`}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-white">{fac.complianceScore}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge status={fac.authorized ? "CONFIRMED" : "PENDING"} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Blockchain Ledger */}
      {activeTab === "blockchain" && (
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>On-Chain EVM Transactions (Chain ID: 31337)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Immutable records committed to the EWasteRegistry contract (0x5FbDB...80aa3).
              </p>
            </div>
            <span className="font-mono text-xs text-emerald-400 font-semibold">
              {blockchainTxs.length} Transactions Confirmed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Tx Hash</th>
                  <th className="p-3">Contract Function</th>
                  <th className="p-3">Block No</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {blockchainTxs.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-emerald-400 font-bold truncate max-w-xs">{tx.txHash}</td>
                    <td className="p-3 text-white font-sans font-semibold">{tx.functionName}</td>
                    <td className="p-3 text-slate-400">{tx.blockNumber ?? "Pending"}</td>
                    <td className="p-3">
                      <Badge status={tx.status} size="sm" />
                    </td>
                    <td className="p-3 text-slate-400 text-[11px] font-sans">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Logs & User Accounts */}
      {activeTab === "audits" && (
        <div className="space-y-6">
          {/* User Account Controls */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>User & Role Governance</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Facility / Org</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {usersList.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{u.fullName}</td>
                      <td className="p-3 text-slate-300 font-mono">{u.email}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{u.facility?.name || u.organization || "—"}</td>
                      <td className="p-3">
                        <Badge status={u.status} size="sm" />
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleUserStatusToggle(u.id, u.status)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            u.status === "APPROVED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                          }`}
                        >
                          {u.status === "APPROVED" ? "Suspend" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chronological Audit Logs */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Immutable System Audit Trail</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400 text-[11px] font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 text-white font-semibold">{log.user?.fullName || "System Engine"}</td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">{log.action}</td>
                      <td className="p-3 font-mono text-slate-300">{log.entityType} ({log.entityId})</td>
                      <td className="p-3 text-slate-400 truncate max-w-xs">{log.detailsJson || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
