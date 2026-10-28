import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, Role } from "../../context/AuthContext";
import {
  Recycle,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Cpu,
  Layers,
  Truck,
  Building2,
  Wrench,
  UserCheck,
  Search,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, quickSwitch } = useAuth();
  const navigate = useNavigate();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const roles: { role: Role; label: string; icon: any; path: string }[] = [
    { role: "ADMIN", label: "Admin Auditor", icon: ShieldCheck, path: "/admin/dashboard" },
    { role: "DEALER", label: "Collector / Dealer", icon: Recycle, path: "/dealer/dashboard" },
    { role: "DRIVER", label: "Transporter / Driver", icon: Truck, path: "/driver/dashboard" },
    { role: "FACTORY", label: "Factory Receiving", icon: Building2, path: "/factory/dashboard" },
    { role: "WORKER", label: "Recycling Worker", icon: Wrench, path: "/worker/dashboard" },
    { role: "CUSTOMER", label: "Customer / Buyer", icon: UserCheck, path: "/customer/dashboard" },
  ];

  const handleQuickSwitch = async (r: Role, path: string) => {
    try {
      await quickSwitch(r);
      setRoleDropdownOpen(false);
      navigate(path);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Recycle className="w-6 h-6 text-slate-950 font-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-white">Eco<span className="text-emerald-400">Trace</span></span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">WEB3-02</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-none">Blockchain E-Waste Traceability</p>
          </div>
        </Link>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link to="/verify" className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors">
            <Search className="w-4 h-4" />
            <span>Public Verify</span>
          </Link>

          {/* Blockchain Node Status */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-mono">EVM 31337</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 text-[11px]">Hardhat Node Live</span>
          </div>
        </nav>

        {/* Right Section: Role Switcher & Auth */}
        <div className="flex items-center gap-3">
          {/* Hackathon Quick Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60 text-xs font-medium transition-all"
              title="Quickly switch between all 6 hackathon user roles"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Switch Role</span>
              <ChevronDown className="w-3 h-3 text-emerald-400" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass-panel p-2 shadow-2xl border border-slate-700 z-50">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                  6 Role Portals
                </div>
                {roles.map((item) => {
                  const Icon = item.icon;
                  const isActive = user?.role === item.role;
                  return (
                    <button
                      key={item.role}
                      onClick={() => handleQuickSwitch(item.role, item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User profile or login button */}
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to={`/${user.role.toLowerCase()}/dashboard`}
                className="hidden sm:flex flex-col text-right leading-tight"
              >
                <span className="text-xs font-bold text-white">{user.fullName}</span>
                <span className="text-[10px] text-emerald-400 font-mono uppercase">{user.role}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login/admin"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
