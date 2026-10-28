import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export const DealerDashboard: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [selectedBatchForQr, setSelectedBatchForQr] = useState<any | null>(null);

  // Form states
  const [categoryId, setCategoryId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [pickupLocation, setPickupLocation] = useState("Electronic City Depot 4, Bengaluru");
  const [sourceType, setSourceType] = useState("Enterprise IT Decommission");
  const [description, setDescription] = useState("");
  const [initialWeightKg, setInitialWeightKg] = useState("");
  const [evidenceHash, setEvidenceHash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dispatch form states
  const [dispatchBatchId, setDispatchBatchId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleReg, setVehicleReg] = useState("KA-01-EQ-9988");
  const [pickupAddress, setPickupAddress] = useState("Electronic City Depot 4, Bengaluru");
  const [dispatchFacilityId, setDispatchFacilityId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesRes, catRes, facRes, driversRes] = await Promise.all([
        api.getBatches(),
        api.getCategories(),
        api.getFacilities(),
        api.getDrivers(),
      ]);

      if (batchesRes.success) setBatches(batchesRes.batches);
      if (catRes.success) {
        setCategories(catRes.categories);
        if (catRes.categories.length > 0) setCategoryId(catRes.categories[0].id);
      }
      if (facRes.success) {
        setFacilities(facRes.facilities);
        if (facRes.facilities.length > 0) {
          setFacilityId(facRes.facilities[0].id);
          setDispatchFacilityId(facRes.facilities[0].id);
        }
      }
      if (driversRes.success) {
        setDrivers(driversRes.drivers);
        if (driversRes.drivers.length > 0) setDriverId(driversRes.drivers[0].id);
      }
    } catch (err) {
      console.error("Failed to load dealer data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createBatch({
        categoryId,
        destinationFacilityId: facilityId,
        pickupLocation,
        sourceType,
        description,
        initialWeightKg: Number(initialWeightKg),
        evidenceHash: evidenceHash || undefined,
      });

      if (res.success) {
        setIsRegisterOpen(false);
        setDescription("");
        setInitialWeightKg("");
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to register batch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createDispatch({
        batchIds: [dispatchBatchId],
        driverId,
        vehicleRegistration: vehicleReg,
        pickupAddress,
        destinationFacilityId: dispatchFacilityId,
      });

      if (res.success) {
        setIsDispatchOpen(false);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to create dispatch");
    } finally {
      setSubmitting(false);
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

  const totalRegisteredWeight = batches.reduce((acc, b) => acc + b.initialWeightKg, 0);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Dealer & Collector Desk</h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregate collected electronics, generate cryptographic QR manifests, and dispatch to authorized facilities.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Register New E-Waste Batch</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          title="Ready for Dispatch"
          value={batches.filter((b) => b.status === "REGISTERED").length}
          subtitle="Awaiting carrier assignment"
          icon={Truck}
          color="amber"
        />
      </div>

      {/* Batches Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Collected E-Waste Manifests</h3>
          <span className="text-xs text-slate-400 font-mono">{batches.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Initial Weight</th>
                <th className="p-3">Status</th>
                <th className="p-3">Destination Facility</th>
                <th className="p-3">On-Chain Tx</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-emerald-400">{batch.batchId}</td>
                  <td className="p-3 font-medium text-white">{batch.category?.name}</td>
                  <td className="p-3 font-mono text-slate-200">{batch.initialWeightKg} kg</td>
                  <td className="p-3">
                    <Badge status={batch.status} size="sm" />
                  </td>
                  <td className="p-3 text-slate-300">{batch.destinationFacility?.name}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                    {batch.txHash || "Local Dev"}
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    {/* View QR Button */}
                    <button
                      onClick={() => setSelectedBatchForQr(batch)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-700 transition-colors"
                      title="View QR Label"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>

                    {/* Dispatch Button if Registered */}
                    {batch.status === "REGISTERED" && (
                      <button
                        onClick={() => {
                          setDispatchBatchId(batch.id);
                          setDispatchFacilityId(batch.destinationFacilityId);
                          setIsDispatchOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1"
                      >
                        <Truck className="w-3 h-3" />
                        <span>Dispatch</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Batch Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full glass-card p-6 rounded-2xl border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Recycle className="w-5 h-5 text-emerald-400" />
                <span>Register Collected E-Waste Batch</span>
              </h3>
              <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterBatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Waste Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Destination Authorized Facility</label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.facilityType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Initial Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 150.5"
                    value={initialWeightKg}
                    onChange={(e) => setInitialWeightKg(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Source Type</label>
                  <input
                    type="text"
                    required
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Pickup Location</label>
                <input
                  type="text"
                  required
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Lot details, electronic model numbers, condition..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Weighing Slip Upload with SHA-256 Digest */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Weighing Slip Proof (SHA-256)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                  />
                </div>
                {evidenceHash && (
                  <p className="mt-1 text-[10px] font-mono text-emerald-400 truncate">
                    Hash: {evidenceHash}
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold disabled:opacity-50"
                >
                  {submitting ? "Signing On-Chain..." : "Confirm & Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Creator Modal */}
      {isDispatchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>Create Transport Dispatch</span>
              </h3>
              <button onClick={() => setIsDispatchOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Assign Driver / Carrier</label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.organization || "Logistics"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Vehicle Registration</label>
                <input
                  type="text"
                  required
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Pickup Address</label>
                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDispatchOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold disabled:opacity-50"
                >
                  {submitting ? "Signing Dispatch..." : "Authorize Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Viewer Modal */}
      {selectedBatchForQr && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full glass-card p-6 rounded-2xl border border-emerald-500/30 text-center space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-mono">{selectedBatchForQr.batchId}</h3>
              <button onClick={() => setSelectedBatchForQr(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl inline-block mx-auto shadow-inner">
              {selectedBatchForQr.qrCodeData ? (
                <img
                  src={selectedBatchForQr.qrCodeData}
                  alt="QR Manifest"
                  className="w-48 h-48 mx-auto"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-800 font-mono text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="text-xs space-y-1 text-slate-300">
              <p className="font-semibold text-white">{selectedBatchForQr.category?.name}</p>
              <p className="font-mono text-emerald-400 font-bold">{selectedBatchForQr.initialWeightKg} kg</p>
              <p className="text-[11px] text-slate-400">{selectedBatchForQr.destinationFacility?.name}</p>
            </div>

            <button
              onClick={() => setSelectedBatchForQr(null)}
              className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
