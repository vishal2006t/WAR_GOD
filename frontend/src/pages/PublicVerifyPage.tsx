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
  Recycle,
  Sparkles,
  FileSpreadsheet,
  Building2,
  MapPin,
  Scale,
} from "lucide-react";

export const PublicVerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
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
    setVerificationResult(null);

    try {
      const res = await api.verifyPublicProduct(targetQuery.trim());
      if (res.success) {
        if (res.product) {
          setVerificationResult({ entityType: "PRODUCT", data: res.product });
        } else if (res.record) {
          setVerificationResult({ entityType: res.entityType, data: res.record });
        } else {
          setError("No matching verifiable record found.");
        }
      } else {
        setError(res.error || "No matching record found");
      }
    } catch (err: any) {
      setError(err.message || "Record not found or verification reference invalid");
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E5F5EA] border border-[#D7E5DB] text-[#075B46] text-xs font-semibold shadow-sm">
          <ShieldCheck className="w-4 h-4 text-[#075B46]" />
          <span>Public E-Waste Provenance Verifier</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif text-[#173C32] tracking-tight">
          Decentralized Provenance Verification
        </h1>
        <p className="text-xs sm:text-sm text-[#6B7C74] max-w-xl mx-auto font-sans leading-relaxed">
          Verify refurbished electronic devices, collection batches, certified recovered materials, and customer circularity claims against the immutable Hardhat blockchain registry.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={onFormSubmit} className="bg-white p-2.5 rounded-2xl border border-[#D7E5DB] shadow-sm flex items-center gap-2">
        <Search className="w-5 h-5 text-[#075B46] ml-3 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Product ID, Serial Number, Batch ID (BATCH-...), Material ID, or Claim Ref..."
          className="w-full bg-transparent px-3 py-2 text-sm text-[#173C32] placeholder-[#6B7C74]/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm hover:scale-[1.02] transition-transform shrink-0 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#6B7C74]">
        <span>Try searching:</span>
        <button
          onClick={() => {
            setQuery("SN-DELL-883921");
            handleSearch("SN-DELL-883921");
          }}
          className="px-2.5 py-1 rounded-xl bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB] font-mono hover:bg-[#E5F5EA] font-semibold transition-colors shadow-sm"
        >
          SN-DELL-883921 (Product)
        </button>
        <button
          onClick={() => {
            setQuery("BATCH-2026-0001");
            handleSearch("BATCH-2026-0001");
          }}
          className="px-2.5 py-1 rounded-xl bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB] font-mono hover:bg-[#E5F5EA] font-semibold transition-colors shadow-sm"
        >
          BATCH-2026-0001 (Batch)
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-white p-6 rounded-2xl border border-rose-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[#173C32]">Verification Status: NOT FOUND</h3>
          <p className="text-xs text-[#6B7C74] max-w-md mx-auto">{error}</p>
          <div className="pt-2 text-xs text-[#6B7C74]">
            Certified items must have a registered Product, Collection Batch, Material, or Customer Claim reference.
          </div>
        </div>
      )}

      {/* Verified Result Card */}
      {verificationResult && (
        <div className="bg-white rounded-3xl border border-[#D7E5DB] shadow-md p-6 sm:p-8 space-y-8 relative overflow-hidden">
          {/* 1. PRODUCT RESULT */}
          {verificationResult.entityType === "PRODUCT" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D7E5DB]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge status="VERIFIED" />
                    <span className="text-[11px] font-mono text-[#075B46] font-semibold">
                      Hardhat EVM 31337 Attested
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-[#173C32]">{verificationResult.data.name}</h2>
                  <p className="text-xs text-[#6B7C74] mt-1">
                    Model: <span className="text-[#173C32] font-medium">{verificationResult.data.brandModel || "Certified Device"}</span> | Condition: <span className="text-[#075B46] font-semibold">{verificationResult.data.condition}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-right">
                  <p className="text-[10px] text-[#6B7C74] uppercase font-mono font-semibold">Serial Number</p>
                  <p className="text-sm font-mono font-bold text-[#075B46]">{verificationResult.data.serialNumber || "N/A"}</p>
                  <p className="text-[10px] text-[#6B7C74] font-mono mt-0.5">{verificationResult.data.productId}</p>
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-1">
                  <p className="text-[11px] text-[#6B7C74] flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#075B46]" />
                    <span>Refurbishment Date</span>
                  </p>
                  <p className="text-sm font-bold text-[#173C32]">
                    {new Date(verificationResult.data.refurbishmentDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-1">
                  <p className="text-[11px] text-[#6B7C74] flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#075B46]" />
                    <span>Warranty Coverage</span>
                  </p>
                  <p className="text-sm font-bold text-[#075B46]">
                    {verificationResult.data.warrantyMonths} Months Certified
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-1">
                  <p className="text-[11px] text-[#6B7C74] flex items-center gap-1.5 font-medium">
                    <Wrench className="w-3.5 h-3.5 text-[#075B46]" />
                    <span>Technician Sign-off</span>
                  </p>
                  <p className="text-sm font-bold text-[#173C32] truncate">
                    {verificationResult.data.technicianName || "Certified Specialist"}
                  </p>
                </div>
              </div>

              {/* Upgrades */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#173C32] uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#075B46]" />
                  <span>Component Diagnostic & Upgrades</span>
                </h4>
                <div className="p-3.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-xs text-[#173C32] font-mono">
                  {verificationResult.data.replacedComponents || "Original OEM components tested intact."}
                </div>
              </div>

              {/* Provenance */}
              {verificationResult.data.sourceOrigin && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#173C32] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#075B46]" />
                    <span>Source E-Waste Intake Provenance</span>
                  </h4>
                  <div className="p-3.5 rounded-xl bg-[#E5F5EA] border border-[#D7E5DB] text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Batch Origin:</span>
                      <span className="font-mono text-[#075B46] font-bold">{verificationResult.data.sourceOrigin.batchId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Waste Stream:</span>
                      <span className="text-[#173C32] font-medium">{verificationResult.data.sourceOrigin.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7C74]">Treatment Hub:</span>
                      <span className="text-[#173C32] font-medium">{verificationResult.data.sourceOrigin.processingHub}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. WASTE BATCH RESULT */}
          {verificationResult.entityType === "WASTE_BATCH" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D7E5DB]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge status="VERIFIED" />
                    <span className="text-[11px] font-mono text-[#075B46] font-semibold">
                      Certified E-Waste Intake Manifest
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-[#173C32] font-mono">{verificationResult.data.batchId}</h2>
                  <p className="text-xs text-[#6B7C74] mt-1">
                    Traceability Ref: <span className="text-[#173C32] font-mono">{verificationResult.data.traceabilityRef}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-right">
                  <p className="text-[10px] text-[#6B7C74] uppercase font-mono font-semibold">Certified Intake Mass</p>
                  <p className="text-lg font-mono font-bold text-[#075B46]">{verificationResult.data.initialWeightKg} kg</p>
                  <p className="text-[10px] text-[#075B46] font-mono">{verificationResult.data.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-1">
                  <span className="text-[#6B7C74] flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>Intake Pickup Site</span>
                  </span>
                  <p className="font-semibold text-[#173C32]">{verificationResult.data.sourceLocation}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-1">
                  <span className="text-[#6B7C74] flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-[#075B46]" />
                    <span>Designated Facility Hub</span>
                  </span>
                  <p className="font-semibold text-[#173C32]">{verificationResult.data.facility}</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. RECOVERY CLAIM RESULT */}
          {verificationResult.entityType === "RECOVERY_CLAIM" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D7E5DB]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge status="VERIFIED" />
                    <span className="text-[11px] font-mono text-[#075B46] font-semibold">
                      Double-Count Protected Circularity Claim
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-[#173C32] font-mono">{verificationResult.data.claimReference}</h2>
                  <p className="text-xs text-[#6B7C74] mt-1">
                    Beneficiary: <span className="text-[#173C32] font-semibold">{verificationResult.data.beneficiary}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-right">
                  <p className="text-[10px] text-[#6B7C74] uppercase font-mono font-semibold">Claimed Circular Weight</p>
                  <p className="text-lg font-mono font-bold text-[#075B46]">{verificationResult.data.claimedWeightKg} kg</p>
                  <p className="text-[10px] text-[#6B7C74] font-mono">{verificationResult.data.materialType}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-xs space-y-1">
                <span className="text-[#6B7C74] font-semibold">Circularity Validation Reason:</span>
                <p className="text-[#173C32]">{verificationResult.data.decisionReason || "Validated against physical recovered inventory stock."}</p>
              </div>
            </div>
          )}

          {/* 4. RECOVERED MATERIAL RESULT */}
          {verificationResult.entityType === "RECOVERED_MATERIAL" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D7E5DB]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge status="VERIFIED" />
                    <span className="text-[11px] font-mono text-[#075B46] font-semibold">
                      Certified Refined Secondary Raw Material
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-[#173C32]">{verificationResult.data.materialType}</h2>
                  <p className="text-xs text-[#6B7C74] mt-1">
                    Purity Rating: <span className="text-[#075B46] font-bold font-mono">{verificationResult.data.purityPercentage}% Purity</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-right">
                  <p className="text-[10px] text-[#6B7C74] uppercase font-mono font-semibold">Available Unallocated Stock</p>
                  <p className="text-lg font-mono font-bold text-[#075B46]">{verificationResult.data.availableWeightKg} kg</p>
                  <p className="text-[10px] text-[#6B7C74] font-mono">Total Refined: {verificationResult.data.recoveredWeightKg} kg</p>
                </div>
              </div>
            </div>
          )}

          {/* Cryptographic Blockchain Receipt Box */}
          <div className="space-y-3 pt-3 border-t border-[#D7E5DB]">
            <h4 className="text-xs font-bold text-[#173C32] uppercase tracking-wider flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#075B46]" />
              <span>Immutable On-Chain Blockchain Proof (Hardhat EVM 31337)</span>
            </h4>
            <div className="p-4 rounded-2xl bg-[#F7FBF7] border border-[#D7E5DB] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B7C74]">Transaction Hash:</span>
                <div className="flex items-center gap-2">
                  <code className="text-[#075B46] font-mono text-[11px] truncate max-w-xs sm:max-w-md font-semibold">
                    {verificationResult.data.txHash || "0x5FbDB2315678afecb367f032d93F642f64180aa3"}
                  </code>
                  <button
                    onClick={() => copyToClipboard(verificationResult.data.txHash || "0x5FbDB2315678afecb367f032d93F642f64180aa3")}
                    className="p-1.5 rounded-lg bg-[#EDF7EF] border border-[#D7E5DB] text-[#075B46] hover:bg-[#E5F5EA]"
                    title="Copy Tx Hash"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#075B46]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-[#D7E5DB] pt-2">
                <span className="text-[#6B7C74]">EVM Smart Contract:</span>
                <code className="text-[#173C32] font-mono text-[11px]">
                  0x5FbDB2315678afecb367f032d93F642f64180aa3
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
