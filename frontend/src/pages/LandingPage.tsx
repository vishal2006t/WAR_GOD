import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Recycle,
  ShieldCheck,
  Search,
  ArrowRight,
  Scale,
  Cpu,
  Truck,
  Building2,
  Wrench,
  UserCheck,
  Link2,
  CheckCircle,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/verify?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const rolePortals = [
    {
      role: "ADMIN",
      title: "Regulatory & Audit Tower",
      desc: "Monitor system-wide mass balance, duplicate claim alerts, audit history, and compliance.",
      path: "/login/admin",
      icon: ShieldCheck,
      color: "from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30",
    },
    {
      role: "DEALER",
      title: "Dealer & Collector Desk",
      desc: "Register incoming e-waste batches, generate QR labels, record initial weights, and assign dispatches.",
      path: "/login/dealer",
      icon: Recycle,
      color: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      role: "FACTORY",
      title: "Factory Intake Station",
      desc: "Perform weighbridge verification, flag discrepancies, record acceptance/rejection, and allocate storage.",
      path: "/login/factory",
      icon: Building2,
      color: "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30",
    },
    {
      role: "WORKER",
      title: "Recycling & Mass-Balance Workbench",
      desc: "Calculate mass balance, recover high-purity metals/plastics, register refurbished goods, and log proofs.",
      path: "/login/worker",
      icon: Wrench,
      color: "from-emerald-500/20 to-lime-500/20 text-emerald-300 border-emerald-500/30",
    },
    {
      role: "CUSTOMER",
      title: "Customer & Provenance Portal",
      desc: "Verify refurbished electronics authenticity, inspection results, service records, and on-chain proofs.",
      path: "/login/customer",
      icon: UserCheck,
      color: "from-teal-500/20 to-emerald-500/20 text-teal-400 border-teal-500/30",
    },
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative pt-16 pb-12 overflow-hidden bg-gradient-to-b from-[#E5F5EA]/60 to-transparent">
        <div className="max-w-4xl mx-auto text-center space-y-6 px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5F5EA] border border-[#D7E5DB] text-xs font-semibold text-[#075B46]">
            <span>Blockchain E-Waste Traceability &amp; Circularity</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-serif text-[#173C32] leading-tight tracking-tight">
            Decentralized E-Waste Traceability &amp; <span className="text-[#075B46] italic">Mass-Balance Audit</span>
          </h1>

          <p className="text-base sm:text-lg text-[#6B7C74] max-w-2xl mx-auto leading-relaxed font-sans">
            EcoTrace provides cryptographically verifiable provenance from dealer collection, transportation, and factory weighbridges to certified circular materials and refurbished consumer goods.
          </p>

          {/* Public Verification Quick Search */}
          <div className="pt-4 max-w-xl mx-auto">
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-[#D7E5DB] shadow-sm">
              <Search className="w-5 h-5 text-[#075B46] ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Enter Product ID or Serial No (e.g. SN-DELL-883921)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent px-3 py-2 text-sm text-[#173C32] placeholder-[#6B7C74]/70 focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm hover:scale-[1.02] transition-transform shrink-0"
              >
                Verify
              </button>
            </form>
            <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-[#6B7C74] font-mono">
              <span>Demo Serials:</span>
              <button
                type="button"
                onClick={() => setSearchQuery("SN-DELL-883921")}
                className="text-[#075B46] underline hover:text-[#087F5B] font-semibold"
              >
                SN-DELL-883921
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => setSearchQuery("PROD-REFURB-001")}
                className="text-[#075B46] underline hover:text-[#087F5B] font-semibold"
              >
                PROD-REFURB-001
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-3 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] flex items-center justify-center">
              <Scale className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xl font-serif text-[#173C32]">Strict Mass-Balance Validation</h3>
            <p className="text-xs text-[#6B7C74] leading-relaxed font-sans">
              Enforces the physical conservation law: <br />
              <code className="text-[#075B46] font-mono text-[11px] font-semibold">Input = Recovered + Residual + Loss</code>.
              Unexplained discrepancies are flagged or rejected on-chain.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-3 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xl font-serif text-[#173C32]">Duplicate-Claim Prevention</h3>
            <p className="text-xs text-[#6B7C74] leading-relaxed font-sans">
              Smart contracts and database constraints prevent circular claims exceeding verified recovered weights, stopping greenwashing and double-counting.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] space-y-3 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] flex items-center justify-center">
              <Link2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xl font-serif text-[#173C32]">Auditable Smart Contracts</h3>
            <p className="text-xs text-[#6B7C74] leading-relaxed font-sans">
              Every critical lifecycle transition emits on-chain events on Hardhat EVM (31337), backed by SHA-256 evidence digests and public verification.
            </p>
          </div>
        </div>
      </section>

      {/* 6 Role Portals Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl sm:text-4xl font-serif text-[#173C32]">Dedicated Role Portals</h2>
          <p className="text-xs text-[#6B7C74] max-w-xl mx-auto font-sans">
            Role-based authentication, customized dashboard views, strict backend permissions, and segregated business workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rolePortals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.role}
                className="bg-white p-6 rounded-2xl border border-[#D7E5DB] hover:border-[#075B46]/40 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl border border-[#D7E5DB] bg-[#EDF7EF] text-[#075B46]">
                      <Icon className="w-6 h-6 stroke-[2]" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB]">
                      {portal.role}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#173C32] group-hover:text-[#075B46] transition-colors">
                      {portal.title}
                    </h3>
                    <p className="mt-2 text-xs text-[#6B7C74] leading-relaxed font-sans">{portal.desc}</p>
                  </div>
                </div>

                <div className="pt-6">
                  <Link
                    to={portal.path}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#EDF7EF] hover:bg-[#075B46] text-[#075B46] hover:text-white font-semibold text-xs border border-[#D7E5DB] transition-all"
                  >
                    <span>Enter {portal.role} Portal</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
