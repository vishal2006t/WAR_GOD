import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Recycle,
  Truck,
  Building2,
  Wrench,
  UserCheck,
  ShieldAlert,
  FileSpreadsheet,
  Link2,
  CheckCircle2,
  Boxes,
  ScrollText,
} from "lucide-react";

interface SidebarItem {
  label: string;
  path: string;
  icon: any;
}

export const RoleSidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const roleNavItems: Record<string, SidebarItem[]> = {
    ADMIN: [
      { label: "Executive Tower", path: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Duplicate Claims", path: "/admin/dashboard#claims", icon: ShieldAlert },
      { label: "Blockchain Ledger", path: "/admin/dashboard#blockchain", icon: Link2 },
      { label: "Audit Logs", path: "/admin/dashboard#audits", icon: ScrollText },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    DEALER: [
      { label: "Collector Desk", path: "/dealer/dashboard", icon: LayoutDashboard },
      { label: "Collection Batches", path: "/dealer/dashboard#batches", icon: Recycle },
      { label: "QR Labels", path: "/dealer/dashboard#qr", icon: Boxes },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    DRIVER: [
      { label: "Transport Desk", path: "/driver/dashboard", icon: LayoutDashboard },
      { label: "Assigned Trips", path: "/driver/dashboard#trips", icon: Truck },
      { label: "Discrepancy Notes", path: "/driver/dashboard#notes", icon: ShieldAlert },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    FACTORY: [
      { label: "Intake Station", path: "/factory/dashboard", icon: LayoutDashboard },
      { label: "Incoming Shipments", path: "/factory/dashboard#incoming", icon: Building2 },
      { label: "Disputed Weighings", path: "/factory/dashboard#disputes", icon: ShieldAlert },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    WORKER: [
      { label: "Recycling Workbench", path: "/worker/dashboard", icon: LayoutDashboard },
      { label: "Mass Balance Engine", path: "/worker/dashboard#massbalance", icon: Wrench },
      { label: "Recovered Materials", path: "/worker/dashboard#materials", icon: Boxes },
      { label: "Refurbished Goods", path: "/worker/dashboard#refurb", icon: Recycle },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    CUSTOMER: [
      { label: "Customer Portal", path: "/customer/dashboard", icon: LayoutDashboard },
      { label: "Certified Provenance", path: "/verify", icon: CheckCircle2 },
      { label: "Warranty Records", path: "/customer/dashboard#warranty", icon: UserCheck },
    ],
  };

  const items = roleNavItems[user.role] || [];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 min-h-[calc(100vh-4rem)] p-4 hidden lg:block">
      {/* Role Profile Badge */}
      <div className="p-3 mb-6 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
          {user.fullName.charAt(0)}
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">{user.role}</span>
          {user.facility && (
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.facility.name}</p>
          )}
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path.split("#")[0]);
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4 text-emerald-400" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Quick Info Panel */}
      <div className="mt-8 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300/80">
        <p className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          <span>Smart Contract Live</span>
        </p>
        <p className="font-mono text-[10px] text-slate-400 truncate">
          0x5FbDB2315678afecb367f032d93F642f64180aa3
        </p>
      </div>
    </aside>
  );
};
