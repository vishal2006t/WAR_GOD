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
  ShieldCheck,
  FileSpreadsheet,
  Link2,
  CheckCircle2,
  Boxes,
  ScrollText,
  Plus,
  Users,
  Navigation,
  Bell,
  Scale,
  Cpu,
  Layers,
  ShoppingBag,
  Laptop,
  Package,
  History,
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
      { label: "Executive Tower", path: "/admin/dashboard#overview", icon: LayoutDashboard },
      { label: "Marketplace Inspection", path: "/admin/dashboard#inspection", icon: ShieldCheck },
      { label: "User Management", path: "/admin/dashboard#users", icon: Users },
      { label: "Excel & Audit Reports", path: "/admin/dashboard#reports", icon: FileSpreadsheet },
      { label: "Duplicate Claims", path: "/admin/dashboard#claims", icon: ShieldAlert },
      { label: "Facility Compliance", path: "/admin/dashboard#compliance", icon: Building2 },
      { label: "Blockchain Ledger", path: "/admin/dashboard#blockchain", icon: Link2 },
      { label: "Audit Logs & Governance", path: "/admin/dashboard#audits", icon: ScrollText },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    DEALER: [
      { label: "Overview", path: "/dealer/dashboard#overview", icon: LayoutDashboard },
      { label: "Nearby Listings", path: "/dealer/dashboard#nearby", icon: Navigation },
      { label: "Resale Marketplace", path: "/dealer/dashboard#resale", icon: Boxes },
      { label: "E-Waste Batches", path: "/dealer/dashboard#batches", icon: Recycle },
      { label: "Register New Batch", path: "/dealer/dashboard#register", icon: Plus },
      { label: "Driver Management", path: "/dealer/dashboard#drivers", icon: Users },
      { label: "Dispatch / Pickups", path: "/dealer/dashboard#dispatch", icon: Truck },
      { label: "Shipment Tracking", path: "/dealer/dashboard#tracking", icon: Navigation },
      { label: "Notifications", path: "/dealer/dashboard#notifications", icon: Bell },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    DRIVER: [
      { label: "Transport Desk", path: "/driver/dashboard#overview", icon: LayoutDashboard },
      { label: "Customer Pickups", path: "/driver/dashboard#customer-pickups", icon: Navigation },
      { label: "Assigned Trips", path: "/driver/dashboard#trips", icon: Truck },
      { label: "Completed Handovers", path: "/driver/dashboard#completed", icon: CheckCircle2 },
      { label: "Exception Reports", path: "/driver/dashboard#notes", icon: ShieldAlert },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    FACTORY: [
      { label: "Intake Station", path: "/factory/dashboard#overview", icon: LayoutDashboard },
      { label: "Recovered Materials Mkt", path: "/factory/dashboard#materials-mkt", icon: Boxes },
      { label: "Incoming Shipments", path: "/factory/dashboard#incoming", icon: Building2 },
      { label: "Weighbridge History", path: "/factory/dashboard#history", icon: Scale },
      { label: "Disputed Weighings", path: "/factory/dashboard#disputes", icon: ShieldAlert },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    WORKER: [
      { label: "Recycling Workbench", path: "/worker/dashboard#overview", icon: LayoutDashboard },
      { label: "Mass Balance Engine", path: "/worker/dashboard#massbalance", icon: Wrench },
      { label: "Recovered Materials", path: "/worker/dashboard#materials", icon: Boxes },
      { label: "Refurbished Goods", path: "/worker/dashboard#refurb", icon: Recycle },
      { label: "Processing History", path: "/worker/dashboard#history", icon: CheckCircle2 },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
    CUSTOMER: [
      { label: "Circular Marketplace", path: "/customer/dashboard#marketplace", icon: ShoppingBag },
      { label: "Sell My Device", path: "/customer/dashboard#sell", icon: Plus },
      { label: "My Listings", path: "/customer/dashboard#my-listings", icon: Laptop },
      { label: "My Purchases", path: "/customer/dashboard#my-purchases", icon: Package },
      { label: "Product History", path: "/customer/dashboard#history", icon: History },
      { label: "Audited Claims", path: "/customer/dashboard#claims", icon: ShieldAlert },
      { label: "Public Verifier", path: "/verify", icon: CheckCircle2 },
    ],
  };

  const items = roleNavItems[user.role] || [];

  return (
    <aside className="w-64 bg-white border-r border-[#D7E5DB] min-h-[calc(100vh-4rem)] p-4 hidden lg:block shrink-0 shadow-sm">
      {/* Role Profile Badge */}
      <div className="p-3 mb-6 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] flex items-center justify-center font-bold text-sm shadow-sm">
          {user.fullName.charAt(0)}
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-bold text-[#173C32] truncate">{user.fullName}</p>
          <span className="text-[10px] font-mono text-[#075B46] uppercase tracking-wider font-semibold">{user.role}</span>
          {user.facility && (
            <p className="text-[10px] text-[#6B7C74] truncate mt-0.5">{user.facility.name}</p>
          )}
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const itemHash = item.path.includes("#") ? item.path.split("#")[1] : "";
          const itemPathOnly = item.path.split("#")[0];

          const isActive =
            item.path === "/verify"
              ? location.pathname === "/verify"
              : location.pathname === itemPathOnly &&
                (location.hash === `#${itemHash}` ||
                  (!location.hash && (itemHash === "overview" || itemHash === "")));

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[#E5F5EA] text-[#075B46] border border-emerald-500/40 shadow-sm"
                  : "text-[#6B7C74] hover:text-[#173C32] hover:bg-[#F7FBF7]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#075B46]" : "text-[#6B7C74]"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Quick Info Panel */}
      <div className="mt-8 p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] text-[11px] text-[#173C32]">
        <p className="font-semibold text-[#075B46] mb-1 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          <span>Smart Contract Live</span>
        </p>
        <p className="font-mono text-[10px] text-[#6B7C74] truncate">
          0x5FbDB2315678afecb367f032d93F642f64180aa3
        </p>
      </div>
    </aside>
  );
};
