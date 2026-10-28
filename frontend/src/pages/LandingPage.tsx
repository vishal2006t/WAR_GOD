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
  Sparkles,
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
      role: "DRIVER",
      title: "Logistics & Transport Desk",
      desc: "Manage assigned dispatches, update live trip status, upload delivery proof, and log handovers.",
      path: "/login/driver",
      icon: Truck,
      color: "from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30",
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
      <section className="relative pt-12 pb-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0B0F17] to-[#0B0F17] -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-6 px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Problem Statement WEB3-02 — 36-Hour Hackathon</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Decentralized E-Waste Traceability & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Mass-Balance Audit</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            EcoTrace provides cryptographically verifiable provenance from dealer collection, transportation, and factory weighbridges to certified circular materials and refurbished consumer goods.
          </p>

          {/* Public Verification Quick Search */}
          <div className="pt-4 max-w-xl mx-auto">
            <form onSubmit={handleSearch} className="flex items-center gap-2 glass-panel p-2 rounded-2xl border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
              <Search className="w-5 h-5 text-emerald-400 ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Enter Product ID or Serial No (e.g. SN-DELL-883921)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-transform shrink-0"
              >
                Verify
              </button>
            </form>
            <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-slate-400 font-mono">
              <span>Demo Serials:</span>
              <button
                type="button"
                onClick={() => setSearchQuery("SN-DELL-883921")}
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                SN-DELL-883921
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => setSearchQuery("PROD-REFURB-001")}
                className="text-emerald-400 underline hover:text-emerald-300"
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
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Scale className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Strict Mass-Balance Validation</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Enforces the physical conservation law: <br />
              <code className="text-emerald-400 font-mono text-[11px]">Input = Recovered + Residual + Loss</code>.
              Unexplained discrepancies are flagged or rejected on-chain.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Duplicate-Claim Prevention</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Smart contracts and database constraints prevent circular claims exceeding verified recovered weights, stopping greenwashing and double-counting.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Link2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Auditable Smart Contracts</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every critical lifecycle transition emits on-chain events on Hardhat EVM (31337), backed by SHA-256 evidence digests and public verification.
            </p>
          </div>
        </div>
      </section>

      {/* 6 Role Portals Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Six Dedicated Role Portals</h2>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Role-based authentication, customized dashboard views, strict backend permissions, and segregated business workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rolePortals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.role}
                className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between group hover:shadow-xl hover:shadow-emerald-950/20"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl border bg-gradient-to-tr ${portal.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {portal.role}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {portal.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">{portal.desc}</p>
                  </div>
                </div>

                <div className="pt-6">
                  <Link
                    to={portal.path}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-600 text-slate-200 hover:text-slate-950 font-semibold text-xs border border-slate-700/80 hover:border-emerald-500 transition-all"
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
