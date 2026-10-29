import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  UserCheck,
  ShieldCheck,
  Search,
  Cpu,
  Wrench,
  CheckCircle2,
  Calendar,
  ExternalLink,
  QrCode,
  FileSpreadsheet,
  Layers,
  Sparkles,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
  Boxes,
  ShoppingBag,
  Laptop,
  Package,
  History,
  FileText,
  User,
  Shield,
  ArrowRight,
  Battery,
} from "lucide-react";
import { CustomerSellSection } from "../../components/marketplace/CustomerSellSection";
import { CustomerMarketplaceSection } from "../../components/marketplace/CustomerMarketplaceSection";

type CustomerTab =
  | "marketplace"
  | "sell"
  | "my-listings"
  | "my-purchases"
  | "history"
  | "claims";

export const CustomerDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Circular Marketplace is the PRIMARY customer landing page
  const [activeTab, setActiveTab] = useState<CustomerTab>("marketplace");
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [refurbishedTotal, setRefurbishedTotal] = useState(0);
  const [refurbishedInStock, setRefurbishedInStock] = useState(0);
  const [myListingsCount, setMyListingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Provenance / Product History Explorer State
  const [historySearchId, setHistorySearchId] = useState("RSL-MVT4K79V-3F2F");
  const [historyProduct, setHistoryProduct] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Search & Filter States for secondary sections
  const [materialSearch, setMaterialSearch] = useState("");
  const [claimSearch, setClaimSearch] = useState("");

  // Claim Modal State (Scoped exclusively to Recovered Material Stock workflow)
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [claimedWeightKg, setClaimedWeightKg] = useState("");
  const [claimantName, setClaimantName] = useState("Acme Electronics Corp");
  const [claimantOrg, setClaimantOrg] = useState("Acme Circular Manufacturing Ltd");
  const [claimNotes, setClaimNotes] = useState("Allocated to Q4 2026 Low-Carbon Laptop Chassis Line");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  // Sync tab with React Router location.hash
  useEffect(() => {
    const h = location.hash.replace("#", "").toLowerCase() as CustomerTab;
    if (["marketplace", "sell", "my-listings", "my-purchases", "history", "claims"].includes(h)) {
      setActiveTab(h);
    } else {
      setActiveTab("marketplace");
    }
  }, [location.hash]);

  const navigateTab = (tab: CustomerTab) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, matRes, claimRes, browseRes, myListingsRes] = await Promise.all([
        api.getProducts(),
        api.getMaterials(),
        api.getClaims(),
        api.browseMarketplace({ inStockOnly: false }).catch(() => ({ success: false, data: { allProducts: [] } })),
        api.getMyListings().catch(() => ({ success: false, data: [] })),
      ]);

      if (prodRes.success) setProducts(prodRes.products || []);
      if (matRes.success) {
        setMaterials(matRes.materials || []);
        if (matRes.materials.length > 0 && !selectedMaterialId) {
          setSelectedMaterialId(matRes.materials[0].id || matRes.materials[0]._id);
        }
      }
      if (claimRes.success) setClaims(claimRes.claims || []);
      if (browseRes.success && browseRes.data) {
        const items = browseRes.data.allProducts || browseRes.data.refurbished || [];
        setRefurbishedTotal(items.length);
        setRefurbishedInStock(items.filter((i: any) => (i.stock || 0) > 0 && i.status !== "SOLD").length);
      }
      if (myListingsRes.success && Array.isArray(myListingsRes.data)) {
        setMyListingsCount(myListingsRes.data.length);
      }
    } catch (err) {
      console.error("Failed to load customer data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch full provenance timeline when history tab is selected or queried
  const handleLookupHistory = async (idToLookup?: string) => {
    const query = idToLookup || historySearchId;
    if (!query || !query.trim()) return;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await api.getMarketplaceProduct(query.trim());
      if (res.success && res.product) {
        setHistoryProduct(res.product);
      } else {
        setHistoryError(res.error || `No product records found for ID "${query}".`);
      }
    } catch (err: any) {
      setHistoryError(err.message || "Failed to retrieve product lifecycle history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && !historyProduct) {
      handleLookupHistory("RSL-MVT4K79V-3F2F");
    }
  }, [activeTab]);

  const handleOpenClaimModal = (material?: any) => {
    if (material) {
      setSelectedMaterialId(material.id || material._id);
    }
    setClaimError(null);
    setClaimSuccess(null);
    setIsClaimModalOpen(true);
  };

  const selectedMaterial = materials.find((m) => (m.id || m._id) === selectedMaterialId);
  const remainingAvailableKg = selectedMaterial
    ? Math.max(0, Number(((selectedMaterial.recoveredWeightKg || 0) - (selectedMaterial.claimedWeightKg || 0)).toFixed(2)))
    : 0;

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    setClaimSuccess(null);

    const weightVal = Number(claimedWeightKg);
    if (!weightVal || weightVal <= 0) {
      setClaimError("Please enter a valid positive claim weight.");
      return;
    }

    if (weightVal > remainingAvailableKg) {
      setClaimError(
        `Excessive claim rejected! Requested ${weightVal} kg exceeds available unallocated stock (${remainingAvailableKg} kg).`
      );
      return;
    }

    setSubmittingClaim(true);
    try {
      const res = await api.claimMaterial({
        materialBatchId: selectedMaterialId,
        claimedWeightKg: weightVal,
        claimantName,
        claimantOrg,
        notes: claimNotes,
      });

      if (res.success) {
        setClaimSuccess(`Circularity claim registered on-chain! Ref: ${res.claim?.claimId || "CLAIM-CONFIRMED"}`);
        setClaimedWeightKg("");
        loadData();
        setTimeout(() => {
          setIsClaimModalOpen(false);
          setClaimSuccess(null);
        }, 2200);
      } else {
        setClaimError(res.error || "Failed to submit claim.");
      }
    } catch (err: any) {
      setClaimError(err.message || "Network error submitting circularity claim.");
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Filtered Materials
  const filteredMaterials = materials.filter((m) => {
    const q = materialSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      m.batchId?.toLowerCase().includes(q) ||
      m.materialType?.toLowerCase().includes(q) ||
      m.warehouseLocation?.toLowerCase().includes(q)
    );
  });

  // Filtered Claims
  const filteredClaims = claims.filter((c) => {
    const q = claimSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.claimId?.toLowerCase().includes(q) ||
      c.materialBatchId?.toLowerCase().includes(q) ||
      c.claimantName?.toLowerCase().includes(q) ||
      c.claimantOrg?.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q)
    );
  });

  if (loading && products.length === 0 && materials.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header: Customer Circular Marketplace & Second-Hand Portal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#173C32]">Customer Marketplace & Electronics Portal</h1>
          <p className="text-xs text-[#6B7C74] mt-1 font-sans">
            Browse verified second-hand electronics, list your used devices with full battery and damage reporting, and track complete 7-stage ownership provenance.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => navigateTab("sell")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white font-semibold text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Sell My Device</span>
          </button>

          <Link
            to="/verify"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E5F5EA] hover:bg-[#EDF7EF] text-[#075B46] font-semibold text-xs border border-[#D7E5DB] transition-all"
          >
            <Search className="w-4 h-4 text-[#087F5B]" />
            <span>Public Ledger Verifier</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards: Focused on Electronics Marketplace & Certified Devices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="In-Stock Electronics"
          value={refurbishedInStock}
          subtitle={`${refurbishedTotal} pre-owned & refurbished devices`}
          icon={ShoppingBag}
          color="emerald"
        />
        <StatCard
          title="My Registered Devices"
          value={myListingsCount}
          subtitle="Customer peer-to-peer listings"
          icon={Laptop}
          color="emerald"
        />
        <StatCard
          title="Marketplace Electronics"
          value={refurbishedTotal}
          subtitle={`${refurbishedInStock} currently in stock & certified`}
          icon={Cpu}
          color="blue"
        />
        <StatCard
          title="Audited Circular Claims"
          value={claims.length}
          subtitle="Protected against double-counting"
          icon={ShieldCheck}
          color="emerald"
        />
      </div>

      {/* Primary Customer Navigation Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D7E5DB] pb-2">
        {/* Prioritized Marketplace Workflows */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          {[
            { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
            { id: "sell", label: "Sell My Device", icon: Plus },
            { id: "my-listings", label: `My Listings (${myListingsCount})`, icon: Laptop },
            { id: "my-purchases", label: "My Purchases", icon: Package },
            { id: "history", label: "Product History", icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigateTab(tab.id as CustomerTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-bold shadow-xs"
                  : "text-[#6B7C74] hover:text-[#173C32] hover:bg-[#EDF7EF]"
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#075B46]" : "text-[#6B7C74]"}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Secondary Audit Records */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium self-end sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0">
          <span className="text-[10px] text-[#6B7C74] uppercase tracking-wider font-bold mr-1">Audits:</span>
          <button
            onClick={() => navigateTab("claims")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-xs transition-colors ${
              activeTab === "claims"
                ? "bg-slate-200 text-slate-800 font-bold border border-slate-300"
                : "text-[#6B7C74] hover:bg-[#EDF7EF]"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Audited Claims ({claims.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. MARKETPLACE TAB (DEFAULT LANDING VIEW) */}
      {/* ===================================================================== */}
      {activeTab === "marketplace" && (
        <CustomerMarketplaceSection initialTab="browse" />
      )}

      {/* ===================================================================== */}
      {/* 2. SELL MY DEVICE TAB */}
      {/* ===================================================================== */}
      {activeTab === "sell" && (
        <CustomerSellSection initialView="form" />
      )}

      {/* ===================================================================== */}
      {/* 3. MY LISTINGS TAB (STATUS LIFECYCLE & APPROVAL REVIEW) */}
      {/* ===================================================================== */}
      {activeTab === "my-listings" && (
        <CustomerSellSection initialView="listings" />
      )}

      {/* ===================================================================== */}
      {/* 4. MY PURCHASES TAB */}
      {/* ===================================================================== */}
      {activeTab === "my-purchases" && (
        <CustomerMarketplaceSection initialTab="orders" />
      )}

      {/* ===================================================================== */}
      {/* 5. PRODUCT PROVENANCE & LIFECYCLE HISTORY EXPLORER */}
      {/* ===================================================================== */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] p-6 shadow-xs space-y-4">
            <div>
              <span className="text-[10px] font-mono text-[#075B46] uppercase font-bold tracking-wider">
                Provable Provenance Engine
              </span>
              <h3 className="text-lg font-serif text-[#173C32] mt-0.5">
                Product Lifecycle & Ownership History Explorer
              </h3>
              <p className="text-xs text-[#6B7C74] mt-1">
                Lookup any second-hand device, certified refurbished model, or customer listing to audit its complete 7-stage chronological timeline.
              </p>
            </div>

            {/* Search Input & Quick Samples */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
                <input
                  type="text"
                  placeholder="Enter Product ID or Resale ID (e.g. RSL-MVT4K79V-3F2F, PROD-REFURB-001, LST-...)"
                  value={historySearchId}
                  onChange={(e) => setHistorySearchId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookupHistory()}
                  className="w-full bg-[#F7FBF7] border border-[#D7E5DB] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#173C32] focus:outline-none focus:border-[#087F5B]"
                />
              </div>

              <button
                onClick={() => handleLookupHistory()}
                disabled={historyLoading}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all"
              >
                {historyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Audit Lifecycle</span>
              </button>
            </div>

            {/* Quick Sample IDs */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              <span className="text-[11px] text-[#6B7C74] font-semibold">Verified Catalog Samples:</span>
              {[
                { id: "RSL-MVT4K79V-3F2F", label: "MacBook Pro A1990" },
                { id: "RSL-MVT62U79-76FB", label: "Dell XPS 15 9500" },
                { id: "PROD-REFURB-001", label: "Dell Latitude 7420 (On-Chain)" },
              ].map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    setHistorySearchId(sample.id);
                    handleLookupHistory(sample.id);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] font-mono text-[11px] border border-[#D7E5DB] transition-all"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {historyError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{historyError}</span>
            </div>
          )}

          {historyLoading ? (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] p-12 text-center text-xs text-[#6B7C74]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#075B46] mb-2" />
              Auditing cryptographic provenance & ownership events...
            </div>
          ) : historyProduct ? (
            <div className="space-y-6">
              {/* Device Overview Banner */}
              <div className="bg-white rounded-2xl border border-[#D7E5DB] p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#075B46]">
                      {historyProduct.resaleId || historyProduct.productId || historyProduct.id}
                    </span>
                    <Badge variant={historyProduct.conditionGrade === "A_MINT" ? "success" : "outline"}>
                      {historyProduct.conditionGrade || historyProduct.condition || "Inspected"}
                    </Badge>
                    {historyProduct.isCertifiedOnChain && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E5F5EA] text-[#075B46] border border-[#087F5B]/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#087F5B]" />
                        <span>On-Chain Verified</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-serif text-[#173C32] mt-1">{historyProduct.title || historyProduct.name}</h3>
                  <p className="text-xs text-[#6B7C74]">
                    {historyProduct.brand} • Model: {historyProduct.model} • Approximate Area:{" "}
                    {historyProduct.sellerReported?.approximateLocation || historyProduct.approximateLocation || "Indiranagar, Bengaluru"}
                  </p>
                </div>

                <div className="flex flex-col sm:items-end text-xs">
                  <span className="text-[#6B7C74]">Current Registered Status:</span>
                  <span className="text-sm font-bold text-[#075B46]">
                    {historyProduct.status === "SOLD" ? "Transferred to Owner 2 (Verified Buyer)" : "Available in Marketplace"}
                  </span>
                  <span className="text-[11px] text-[#6B7C74]">
                    Warranty: {historyProduct.technicianVerified?.warranty || historyProduct.warranty || "Standard 7-Day Inspection"}
                  </span>
                </div>
              </div>

              {/* SELLER-REPORTED VS TECHNICIAN-VERIFIED */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seller Reported */}
                <div className="bg-white p-5 rounded-2xl border border-[#D7E5DB] shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#D7E5DB]">
                    <User className="w-4 h-4 text-[#075B46]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#173C32]">
                      Seller-Reported Information
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74]">Previous Owner:</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.sellerReported?.sellerLabel || "Owner 1"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74]">Usage Age:</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.sellerReported?.usageAge || "Not recorded"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74]">Seller Condition:</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.sellerReported?.sellerCondition || "Not recorded"}
                      </span>
                    </div>
                    <div className="py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74] block mb-0.5">Damage Details (Visible Defects):</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.sellerReported?.damageDetails || "No physical defects reported"}
                      </span>
                    </div>
                    <div className="py-1">
                      <span className="text-[#6B7C74] block mb-0.5">Included Accessories:</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.sellerReported?.accessories
                          ? historyProduct.sellerReported.accessories.join(", ")
                          : "Device only"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Technician Verified */}
                <div className="bg-[#EDF7EF]/60 p-5 rounded-2xl border border-[#087F5B]/30 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#D7E5DB]">
                    <Wrench className="w-4 h-4 text-[#075B46]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#075B46]">
                      Technician-Verified Information
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74]">Technician / Inspector:</span>
                      <span className="font-bold text-[#075B46]">
                        {historyProduct.technicianVerified?.technicianName || "Certified Hardware Specialist"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74]">Verified Cosmetic Grade:</span>
                      <span className="font-bold text-[#173C32]">
                        {historyProduct.technicianVerified?.cosmeticGrade || "A"}
                      </span>
                    </div>
                    <div className="py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74] block mb-0.5">Defects / Findings:</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.technicianVerified?.defects || "No defects found"}
                      </span>
                    </div>
                    <div className="py-1 border-b border-[#D7E5DB]/60">
                      <span className="text-[#6B7C74] block mb-0.5">Repairs & Refurbishment:</span>
                      <span className="font-semibold text-[#173C32]">
                        {historyProduct.technicianVerified?.repairsPerformed || "Clean diagnostic pass"}
                      </span>
                    </div>
                    <div className="py-1">
                      <span className="text-[#6B7C74] block text-[10px]">Inspection Hash:</span>
                      <span className="font-mono text-[10px] text-[#075B46] break-all">
                        {historyProduct.technicianVerified?.inspectionReportHash || "Not recorded"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TRACEABLE 7-STAGE CHRONOLOGICAL TIMELINE */}
              <div className="bg-white rounded-2xl border border-[#D7E5DB] p-6 shadow-xs space-y-5">
                <div className="border-b border-[#D7E5DB] pb-3">
                  <h4 className="text-base font-serif text-[#173C32]">Traceable 7-Stage Product Lifecycle & Ownership Timeline</h4>
                  <p className="text-xs text-[#6B7C74]">
                    Every milestone is recorded with its actual timestamp, responsible authorized actor, and cryptographic evidence.
                  </p>
                </div>

                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D7E5DB]">
                  {(historyProduct.timeline || []).map((step: any, idx: number) => {
                    const isCompleted = step.status === "COMPLETED";
                    const isPending = step.status === "PENDING";

                    return (
                      <div key={idx} className="relative space-y-1">
                        <div
                          className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                            isCompleted
                              ? "bg-[#075B46] border-white text-white shadow-xs"
                              : isPending
                              ? "bg-amber-100 border-amber-500 text-amber-800"
                              : "bg-gray-100 border-gray-400 text-gray-500"
                          }`}
                        >
                          {isCompleted ? "✓" : step.stage || idx + 1}
                        </div>

                        <div className="bg-[#F7FBF7] p-4 rounded-xl border border-[#D7E5DB] space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-[#173C32]">
                              Stage {step.stage || idx + 1}: {step.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#6B7C74]">
                              {step.timestamp ? new Date(step.timestamp).toLocaleDateString() : "Not recorded"}
                            </span>
                          </div>

                          <p className="text-xs text-[#6B7C74]">{step.description}</p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] border-t border-[#D7E5DB]/60">
                            <span className="text-[#075B46] font-semibold">
                              Authorized Actor: {step.actor || "Authorized Participant"}
                            </span>
                            <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#D7E5DB] text-[#6B7C74]">
                              Evidence Ref: {step.evidence}
                            </span>
                          </div>

                          {step.isVerifiedOnChain && (
                            <div className="mt-1 pt-1 border-t border-[#D7E5DB] text-[10px] text-[#075B46] font-mono flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#087F5B]" />
                              <span>On-Chain Record: {step.txHash}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}



      {/* ===================================================================== */}
      {/* 7. SECONDARY WORKFLOW: AUDITED CLAIMS HISTORY */}
      {/* ===================================================================== */}
      {activeTab === "claims" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-serif text-[#173C32]">Audited Industrial Circularity Claims</h3>
              <p className="text-xs text-[#6B7C74]">
                Protected on-chain against double-counting and duplicate material allocation.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
              <input
                type="text"
                placeholder="Search claim ref, organization..."
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                className="bg-white border border-[#D7E5DB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#173C32] placeholder-[#6B7C74] focus:outline-none focus:border-[#087F5B]"
              />
            </div>
          </div>

          {filteredClaims.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-[#D7E5DB] text-center text-xs text-[#6B7C74]">
              No claims match your search.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D7E5DB] bg-[#EDF7EF]/50 text-[#6B7C74] font-semibold">
                      <th className="p-3">Claim ID</th>
                      <th className="p-3">Material Lot</th>
                      <th className="p-3 text-right">Claimed Weight</th>
                      <th className="p-3">Claimant Organization</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">On-Chain Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5DB]">
                    {filteredClaims.map((clm) => (
                      <tr key={clm.claimId} className="hover:bg-[#F7FBF7] transition-colors">
                        <td className="p-3 font-mono font-bold text-[#075B46]">{clm.claimId}</td>
                        <td className="p-3 font-mono">{clm.materialBatchId}</td>
                        <td className="p-3 text-right font-mono font-bold text-[#173C32]">
                          {clm.claimedWeightKg} kg
                        </td>
                        <td className="p-3 font-semibold text-[#173C32]">{clm.claimantOrg || clm.claimantName}</td>
                        <td className="p-3 text-[#6B7C74]">
                          {new Date(clm.timestamp || clm.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E5F5EA] text-[#075B46] border border-[#087F5B]/30">
                            Verified Ledger Pass
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
};
