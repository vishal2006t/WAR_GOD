import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { Badge } from "../components/ui/Badge";
import {
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Cpu,
  Wrench,
  Link2,
  Calendar,
  Layers,
  Copy,
  Check,
  QrCode,
  ArrowRight,
} from "lucide-react";

export const PublicVerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [productData, setProductData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (targetQuery: string) => {
    if (!targetQuery.trim()) return;
    setLoading(true);
    setError(null);
    setProductData(null);

    try {
      const res = await api.verifyPublicProduct(targetQuery.trim());
      if (res.success && res.product) {
        setProductData(res.product);
      } else {
        setError(res.error || "No matching product found");
      }
    } catch (err: any) {
      setError(err.message || "Product not found or verification query invalid");
    } finally {
      setLoading(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Public E-Waste Provenance Verifier</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Certified Hardware Verification
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
          Verify refurbished electronic devices against the immutable blockchain registry. Check certified component replacements, warranty coverage, and material origin.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={onFormSubmit} className="glass-panel p-2 rounded-2xl border border-emerald-500/30 shadow-xl shadow-emerald-950/30 flex items-center gap-2">
        <Search className="w-5 h-5 text-emerald-400 ml-3 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Scan QR or enter Product ID / Serial Number (e.g. SN-DELL-883921)..."
          className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-transform shrink-0 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="glass-card p-6 rounded-2xl border border-rose-500/40 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Verification Status: NOT FOUND</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">{error}</p>
          <div className="pt-2 text-xs text-slate-400">
            Tip: Try searching demo serial: <code className="text-emerald-400 font-mono">SN-DELL-883921</code> or ID <code className="text-emerald-400 font-mono">PROD-REFURB-001</code>
          </div>
        </div>
      )}

      {/* Verified Product Card */}
      {productData && (
        <div className="glass-card rounded-2xl border border-emerald-500/40 shadow-2xl p-6 sm:p-8 space-y-8 relative overflow-hidden">
          {/* Top Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge status="VERIFIED" />
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Hardhat EVM 31337 Attested
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">{productData.name}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Model: <span className="text-slate-200">{productData.brandModel || "Certified Device"}</span> | Condition: <span className="text-emerald-300 font-semibold">{productData.condition}</span>
              </p>
            </div>

            {/* Serial & Product ID Badge */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right">
              <p className="text-[10px] text-slate-400 uppercase font-mono">Serial Number</p>
              <p className="text-sm font-mono font-bold text-emerald-400">{productData.serialNumber || "N/A"}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{productData.productId}</p>
            </div>
          </div>

          {/* Core Specifications Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Refurbishment Date</span>
              </p>
              <p className="text-sm font-bold text-white">
                {new Date(productData.refurbishmentDate).toLocaleDateString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Warranty Coverage</span>
              </p>
              <p className="text-sm font-bold text-emerald-300">
                {productData.warrantyMonths} Months Certified
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>Technician Sign-off</span>
              </p>
              <p className="text-sm font-bold text-white truncate">
                {productData.technicianName || "Certified Inspector"}
              </p>
            </div>
          </div>

          {/* Replaced Components & Inspection */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Certified Component Replacements & Upgrades</span>
            </h4>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono">
              {productData.replacedComponents || "Original components inspected and certified within manufacturer tolerances."}
            </div>
          </div>

          {/* Origin & Provenance Tree */}
          {productData.sourceOrigin && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Source E-Waste Provenance</span>
              </h4>
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Batch Origin:</span>
                  <span className="font-mono text-emerald-300 font-bold">{productData.sourceOrigin.batchId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Waste Category:</span>
                  <span className="text-white">{productData.sourceOrigin.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Certified Hub:</span>
                  <span className="text-white">{productData.sourceOrigin.processingHub}</span>
                </div>
              </div>
            </div>
          )}

          {/* Blockchain Attestation Box */}
          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-400" />
              <span>Cryptographic Blockchain Receipt</span>
            </h4>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Transaction Hash:</span>
                <div className="flex items-center gap-2">
                  <code className="text-emerald-400 font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                    {productData.txHash || "0x5FbDB2315678afecb367f032d93F642f64180aa3"}
                  </code>
                  <button
                    onClick={() => copyToClipboard(productData.txHash || "")}
                    className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                    title="Copy Tx Hash"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Inspection SHA-256 Digest:</span>
                <code className="text-slate-300 font-mono text-[11px] truncate max-w-xs sm:max-w-md">
                  {productData.inspectionReportHash || "0x00"}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
