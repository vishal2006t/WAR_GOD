import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  Truck,
  MapPin,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Navigation,
  ArrowRight,
  Clock,
  Layers,
} from "lucide-react";

export const DriverDashboard: React.FC = () => {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispatch, setSelectedDispatch] = useState<any | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    setLoading(true);
    try {
      const res = await api.getDispatches();
      if (res.success) setDispatches(res.dispatches);
    } catch (err) {
      console.error("Failed to load driver dispatches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (dispatchId: string, currentStatus: string) => {
    const nextStatusMap: Record<string, string> = {
      ASSIGNED: "PICKED_UP",
      PICKED_UP: "IN_TRANSIT",
      IN_TRANSIT: "DELIVERED",
    };

    const nextStatus = nextStatusMap[currentStatus];
    if (!nextStatus) return;

    setUpdating(true);
    try {
      const res = await api.updateDispatchStatus(dispatchId, {
        status: nextStatus,
        discrepancyNotes: discrepancyNote || undefined,
      });

      if (res.success) {
        setDiscrepancyNote("");
        loadDispatches();
      }
    } catch (err: any) {
      alert(err.message || "Failed to update trip status");
    } finally {
      setUpdating(false);
    }
  };

  const activeTrips = dispatches.filter(
    (d) => d.status === "ASSIGNED" || d.status === "PICKED_UP" || d.status === "IN_TRANSIT"
  );
  const completedTrips = dispatches.filter(
    (d) => d.status === "DELIVERED" || d.status === "RECEIVED"
  );

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Transporter & Driver Desk</h1>
        <p className="text-xs text-slate-400 mt-1">
          Assigned dispatches, vehicle manifests, status telemetry, and digital chain-of-custody handovers.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Assigned Trips"
          value={activeTrips.length}
          subtitle="In custody or transit"
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Total Payload Transported"
          value={`${dispatches.reduce((acc, d) => acc + d.dispatchedWeightKg, 0).toFixed(1)} kg`}
          subtitle="Cumulative cargo mass"
          icon={Navigation}
          color="emerald"
        />
        <StatCard
          title="Completed Handovers"
          value={completedTrips.length}
          subtitle="Delivered to factory receiving"
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      {/* Dispatches List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-400" />
          <span>My Assigned Transport Shipments</span>
        </h3>

        {dispatches.length === 0 ? (
          <div className="glass-card p-8 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
            No active trips assigned.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispatches.map((dispatch) => {
              const canAdvance = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(dispatch.status);
              const nextStatusLabel: Record<string, string> = {
                ASSIGNED: "Confirm Pickup",
                PICKED_UP: "Start In-Transit",
                IN_TRANSIT: "Confirm Delivery",
              };

              return (
                <div
                  key={dispatch.id}
                  className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-400 text-sm">{dispatch.dispatchId}</span>
                        <span className="text-xs text-slate-400 font-mono">({dispatch.vehicleRegistration})</span>
                      </div>
                      <Badge status={dispatch.status} size="sm" />
                    </div>

                    {/* Weight & Batches */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase font-mono">Payload Mass</span>
                        <p className="font-mono font-bold text-white">{dispatch.dispatchedWeightKg} kg</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase font-mono">Manifested Batches</span>
                        <p className="font-mono font-semibold text-emerald-400">{dispatch.batches.length} Batches</p>
                      </div>
                    </div>

                    {/* Routing Details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Pickup Location</p>
                          <p className="text-slate-300">{dispatch.pickupAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Destination Hub</p>
                          <p className="text-slate-300">{dispatch.destinationFacility?.name}</p>
                        </div>
                      </div>
                    </div>

                    {dispatch.discrepancyNotes && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                        <p className="font-semibold text-[11px]">Discrepancy Logged:</p>
                        <p className="mt-0.5">{dispatch.discrepancyNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {canAdvance && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <input
                        type="text"
                        placeholder="Optional incident / discrepancy note..."
                        value={discrepancyNote}
                        onChange={(e) => setDiscrepancyNote(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => handleAdvanceStatus(dispatch.id, dispatch.status)}
                        disabled={updating}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <span>{nextStatusLabel[dispatch.status]}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
