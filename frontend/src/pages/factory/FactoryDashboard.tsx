import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export const FactoryDashboard: React.FC = () => {
  const [incoming, setIncoming] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedDispatch, setSelectedDispatch] = useState<any | null>(null);
  const [measuredWeightKg, setMeasuredWeightKg] = useState("");
  const [acceptedWeightKg, setAcceptedWeightKg] = useState("");
  const [rejectedWeightKg, setRejectedWeightKg] = useState("0");
  const [storageLocation, setStorageLocation] = useState("Bay-A-Shelves-04");
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    setInspectionNotes("Intact security seals. No tampering detected during transit.");
  };

  const handleConfirmReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;

    const measured = Number(measuredWeightKg);
    const accepted = Number(acceptedWeightKg);
    const rejected = Number(rejectedWeightKg);

    if (accepted + rejected > measured + 0.05) {
      alert("Accepted weight + Rejected weight cannot exceed measured weight!");
      return;
    }

    const weightDiff = Math.abs(selectedDispatch.dispatchedWeightKg - measured);
    const hasDiscrepancy = weightDiff > 0.5;

    if (hasDiscrepancy && !discrepancyReason.trim()) {
      alert(`Discrepancy detected: Dispatched was ${selectedDispatch.dispatchedWeightKg} kg, but measured is ${measured} kg. A discrepancy explanation is mandatory!`);
      return;
    }

    setSubmitting(true);
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
      });

      if (res.success) {
        setSelectedDispatch(null);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to confirm receiving");
    } finally {
      setSubmitting(false);
    }
  };

  const totalReceivedKg = history.reduce((acc, r) => acc + r.measuredWeightKg, 0);
  const disputedCount = history.filter((r) => r.isDisputed).length;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Factory Intake & Weighbridge Station</h1>
        <p className="text-xs text-slate-400 mt-1">
          Verify physical incoming e-waste loads, compare weighbridge measurements against dispatch manifests, and flag discrepancies.
        </p>
      </div>

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

      {/* Incoming Shipments Queue */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-4">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Incoming Shipments Queue</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">{incoming.length} Shipments Awaiting Intake</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">Dispatch ID</th>
                <th className="p-3">Carrier / Driver</th>
                <th className="p-3">Vehicle Reg</th>
                <th className="p-3">Dispatched Mass</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {incoming.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No shipments currently pending intake.
                  </td>
                </tr>
              ) : (
                incoming.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-emerald-400">{d.dispatchId}</td>
                    <td className="p-3 text-white font-medium">{d.driver?.fullName || "Assigned Driver"}</td>
                    <td className="p-3 font-mono text-slate-300">{d.vehicleRegistration}</td>
                    <td className="p-3 font-mono text-white font-bold">{d.dispatchedWeightKg} kg</td>
                    <td className="p-3">
                      <Badge status={d.status} size="sm" />
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleOpenReceiveModal(d)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
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

      {/* Receiving History */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-4">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Facility Intake History & Audited Weighings</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">{history.length} Intakes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">Dispatch Ref</th>
                <th className="p-3">Measured Weight</th>
                <th className="p-3">Accepted / Rejected</th>
                <th className="p-3">Discrepancy Status</th>
                <th className="p-3">Storage Bay</th>
                <th className="p-3">Intake Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {history.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-emerald-400">{r.batch?.batchId}</td>
                  <td className="p-3 font-mono text-slate-300">{r.dispatch?.dispatchId}</td>
                  <td className="p-3 font-mono font-bold text-white">{r.measuredWeightKg} kg</td>
                  <td className="p-3 font-mono text-slate-300">
                    <span className="text-emerald-400">{r.acceptedWeightKg} kg</span> /{" "}
                    <span className="text-rose-400">{r.rejectedWeightKg} kg</span>
                  </td>
                  <td className="p-3">
                    <Badge status={r.isDisputed ? "DISPUTED" : "CONFIRMED"} size="sm" />
                  </td>
                  <td className="p-3 text-slate-300 font-mono">{r.storageLocation || "Vault 1"}</td>
                  <td className="p-3 text-slate-400 text-[11px]">
                    {new Date(r.arrivalTime).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weighbridge Intake Modal */}
      {selectedDispatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full glass-card p-6 rounded-2xl border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                <span>Weighbridge Receiving: {selectedDispatch.dispatchId}</span>
              </h3>
              <button onClick={() => setSelectedDispatch(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dispatched Weight Alert */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Carrier Manifest Dispatched Mass:</span>
              <span className="font-mono font-bold text-white text-sm">
                {selectedDispatch.dispatchedWeightKg} kg
              </span>
            </div>

            <form onSubmit={handleConfirmReceiving} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Actual Measured Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={measuredWeightKg}
                  onChange={(e) => setMeasuredWeightKg(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Accepted Mass (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={acceptedWeightKg}
                    onChange={(e) => setAcceptedWeightKg(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Rejected Mass (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={rejectedWeightKg}
                    onChange={(e) => setRejectedWeightKg(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-rose-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Live Discrepancy Alert */}
              {Math.abs(selectedDispatch.dispatchedWeightKg - Number(measuredWeightKg)) > 0.5 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Weight Discrepancy Detected ({Math.abs(selectedDispatch.dispatchedWeightKg - Number(measuredWeightKg)).toFixed(1)} kg difference)</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-rose-300 mb-1 font-medium">
                      Mandatory Discrepancy Reason:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Broken packaging / loss during haulage / moisture drying..."
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Storage Bay / Vault Allocation</label>
                <input
                  type="text"
                  required
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Quality Inspection Notes</label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispatch(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold disabled:opacity-50"
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
