import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export const WorkerDashboard: React.FC = () => {
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [processingRecords, setProcessingRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Processing Modal State
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

  // Refurbished Product Modal State
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [prodName, setProdName] = useState("Lenovo ThinkPad X1 Carbon (Eco-Refurbished)");
  const [prodBrand, setProdBrand] = useState("Lenovo ThinkPad X1");
  const [prodSerial, setProdSerial] = useState(`SN-LENOVO-${Math.floor(100000 + Math.random() * 900000)}`);
  const [prodCondition, setProdCondition] = useState("Grade A - Certified Pristine");
  const [replacedParts, setReplacedParts] = useState("New OEM 57Wh Battery, 1TB Samsung 980 Pro SSD, Arctic MX-4 Repaste");
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  const [submitting, setSubmitting] = useState(false);

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
        if (availRes.batches.length > 0) {
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

  const handleSubmitProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
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
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit processing record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
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
        alert(`Refurbished product registered on-chain with serial: ${prodSerial}`);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to register product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Recycling & Mass-Balance Workbench</h1>
          <p className="text-xs text-slate-400 mt-1">
            Perform disassemblies, calculate strict mass-balance reconciliations, and record recovered certified materials on-chain.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsProductOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 shadow-md transition-all"
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Register Refurbished Product</span>
          </button>
          <button
            onClick={() => setIsProcessingOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Record Recycling & Mass Balance</span>
          </button>
        </div>
      </div>

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

      {/* Live Mass-Balance Reconciler Demo Widget */}
      <MassBalanceCalculator
        inputWeightKg={inputWeightKg}
        recoveredTotalKg={totalRecoveredKg}
        residualWasteKg={Number(residualKg) || 0}
        documentedLossKg={Number(documentedLossKg) || 0}
      />

      {/* Processing History Records */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-4">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span>Audited Processing & Mass Balance Runs</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">{processingRecords.length} Runs Completed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">Processing ID</th>
                <th className="p-3">Source Batch</th>
                <th className="p-3">Input Mass</th>
                <th className="p-3">Total Recovered</th>
                <th className="p-3">Residual / Loss</th>
                <th className="p-3">Mass Balance</th>
                <th className="p-3">Supervisor Status</th>
                <th className="p-3">On-Chain Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {processingRecords.map((proc) => (
                <tr key={proc.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-emerald-400">{proc.processingId}</td>
                  <td className="p-3 font-mono text-white">{proc.sourceBatch?.batchId}</td>
                  <td className="p-3 font-mono text-white font-bold">{proc.inputWeightKg} kg</td>
                  <td className="p-3 font-mono text-emerald-300 font-bold">{proc.totalRecoveredKg} kg</td>
                  <td className="p-3 font-mono text-slate-400">
                    {proc.residualKg} kg / {proc.documentedLossKg} kg
                  </td>
                  <td className="p-3">
                    <Badge status={proc.massBalanceValid ? "CONFIRMED" : "DISPUTED"} size="sm" />
                  </td>
                  <td className="p-3">
                    <Badge status={proc.supervisorApproved ? "VERIFIED" : "PENDING"} size="sm" />
                  </td>
                  <td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                    {proc.txHash || "0x5FbDB...80aa3"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Processing & Mass Balance Modal */}
      {isProcessingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full glass-card p-6 rounded-2xl border border-slate-700 shadow-2xl relative space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                <span>Record E-Waste Recycling Run & Validate Mass-Balance</span>
              </h3>
              <button onClick={() => setIsProcessingOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProcessing} className="space-y-4 text-xs">
              {/* Select Source Batch */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Select Intake Batch for Processing</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => handleBatchSelectChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
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
                <label className="block text-slate-300 mb-1 font-medium">Input Feedstock Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={inputWeightKg}
                  onChange={(e) => setInputWeightKg(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Recovered Materials Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium">Recovered High-Purity Output Fractions</label>
                  <button
                    type="button"
                    onClick={handleAddMaterialRow}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Fraction</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {recoveredList.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                      <input
                        type="text"
                        required
                        placeholder="Material Type (e.g. Copper Cathode)"
                        value={m.materialType}
                        onChange={(e) => handleMaterialChange(idx, "materialType", e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      />
                      <input
                        type="number"
                        step="0.1"
                        required
                        placeholder="Mass (kg)"
                        value={m.weightKg}
                        onChange={(e) => handleMaterialChange(idx, "weightKg", Number(e.target.value))}
                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-emerald-400 font-mono text-xs font-bold"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Purity %"
                        value={m.purityPercentage}
                        onChange={(e) => handleMaterialChange(idx, "purityPercentage", Number(e.target.value))}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 font-mono text-xs"
                      />
                      {recoveredList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialRow(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Residual and Process Loss */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Residual Non-Recoverable Waste (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={residualKg}
                    onChange={(e) => setResidualKg(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Documented Pyrometallurgical Loss (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={documentedLossKg}
                    onChange={(e) => setDocumentedLossKg(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-rose-400 font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Live Mass Balance preview */}
              <MassBalanceCalculator
                inputWeightKg={Number(inputWeightKg) || 0}
                recoveredTotalKg={totalRecoveredKg}
                residualWasteKg={Number(residualKg) || 0}
                documentedLossKg={Number(documentedLossKg) || 0}
              />

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProcessingOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold disabled:opacity-50"
                >
                  {submitting ? "Validating & Minting On-Chain..." : "Reconcile & Sign On-Chain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refurbished Product Modal */}
      {isProductOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <span>Register Refurbished Product</span>
              </h3>
              <button onClick={() => setIsProductOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Product Name</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Serial Number</label>
                <input
                  type="text"
                  required
                  value={prodSerial}
                  onChange={(e) => setProdSerial(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Condition Grade</label>
                  <select
                    value={prodCondition}
                    onChange={(e) => setProdCondition(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Grade A - Certified Pristine">Grade A - Pristine</option>
                    <option value="Grade B - Fully Functional">Grade B - Functional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Warranty Months</label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Replaced Components</label>
                <textarea
                  rows={2}
                  value={replacedParts}
                  onChange={(e) => setReplacedParts(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold disabled:opacity-50"
                >
                  {submitting ? "Signing Product On-Chain..." : "Register & Mint QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
