import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";

export const CustomerDashboard: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchSerial, setSearchSerial] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts();
      if (res.success) setProducts(res.products);
    } catch (err) {
      console.error("Failed to load customer products:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Customer & Provenance Portal</h1>
          <p className="text-xs text-slate-400 mt-1">
            Certified refurbished hardware, verifiable material origin, warranty coverage, and decentralized repair history.
          </p>
        </div>

        <Link
          to="/verify"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all self-start sm:self-auto"
        >
          <Search className="w-4 h-4" />
          <span>Launch Public Verifier</span>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Certified Hardware Catalog"
          value={products.length}
          subtitle="Eco-refurbished products"
          icon={Cpu}
          color="emerald"
        />
        <StatCard
          title="Warranty Active"
          value="100%"
          subtitle="Backed by registered technicians"
          icon={ShieldCheck}
          color="emerald"
        />
        <StatCard
          title="Decentralized Audits"
          value="Hardhat EVM"
          subtitle="Immutable provenance chain"
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      {/* Certified Hardware Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Certified Refurbished Hardware Catalog</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">{products.length} Products Live</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">{prod.productId}</span>
                    <h4 className="text-base font-bold text-white mt-0.5">{prod.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Serial: <span className="text-white">{prod.serialNumber || "N/A"}</span>
                    </p>
                  </div>
                  <Badge status="VERIFIED" size="sm" />
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Condition:</span>
                    <span className="text-emerald-300 font-semibold">{prod.condition}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Warranty:</span>
                    <span className="text-white">{prod.warrantyMonths} Months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Certified Tech:</span>
                    <span className="text-slate-300">{prod.technicianName}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-500 text-[10px] uppercase font-mono block mb-1">Replaced Parts:</span>
                  <p className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] font-mono leading-relaxed">
                    {prod.replacedComponents}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-mono truncate max-w-[140px]">
                  Tx: {prod.txHash ? prod.txHash.slice(0, 10) + "..." : "Local EVM"}
                </span>
                <Link
                  to={`/verify?q=${encodeURIComponent(prod.serialNumber || prod.productId)}`}
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  <span>Audit Provenance</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
