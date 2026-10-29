import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, Role } from "../../context/AuthContext";
import { api } from "../../services/api";
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
  Bell,
  CheckCheck,
  ShoppingBag,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, quickSwitch } = useAuth();
  const navigate = useNavigate();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      // ignore in background
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  };

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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#D7E5DB] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#075B46] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Recycle className="w-5 h-5 text-white stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-serif tracking-tight text-[#173C32]">
                Eco<span className="text-[#075B46]">Trace</span>
              </span>
            </div>
            <p className="text-[10px] text-[#6B7C74] font-medium leading-none">Blockchain E-Waste Traceability</p>
          </div>
        </Link>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#173C32]">
          <Link to="/customer/dashboard#marketplace" className="flex items-center gap-1.5 text-[#075B46] hover:text-[#087F5B] transition-colors font-medium">
            <ShoppingBag className="w-4 h-4" />
            <span>Circular Marketplace</span>
          </Link>

          <Link to="/verify" className="flex items-center gap-1.5 text-[#075B46] hover:text-[#087F5B] transition-colors font-medium">
            <Search className="w-4 h-4" />
            <span>Public Verify</span>
          </Link>

          {/* Blockchain Node Status */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#EDF7EF] border border-[#D7E5DB] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#087F5B] animate-pulse"></span>
            <span className="text-[#173C32] font-mono text-[11px]">EVM 31337</span>
            <span className="text-[#D7E5DB]">|</span>
            <span className="text-[#075B46] text-[11px] font-medium">Hardhat Node Live</span>
          </div>
        </nav>

        {/* Right Section: Role Switcher & Auth */}
        <div className="flex items-center gap-3">
          {/* Quick Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-[#075B46] hover:bg-[#E5F5EA] text-xs font-semibold transition-all shadow-sm"
              title="Quickly switch between all user roles"
            >
              <Cpu className="w-3.5 h-3.5 text-[#075B46]" />
              <span>Switch Role</span>
              <ChevronDown className="w-3 h-3 text-[#075B46]" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-[#D7E5DB] z-50">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-[#6B7C74] uppercase tracking-wider border-b border-[#D7E5DB] mb-1">
                  Role Portals
                </div>
                {roles.map((item) => {
                  const Icon = item.icon;
                  const isActive = user?.role === item.role;
                  return (
                    <button
                      key={item.role}
                      onClick={() => handleQuickSwitch(item.role, item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-semibold"
                          : "text-[#173C32] hover:bg-[#EDF7EF]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-[#075B46]" />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#075B46]"></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-[#173C32] hover:bg-[#E5F5EA] hover:text-[#075B46] transition-colors shadow-sm"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-[#173C32]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#075B46] text-[9px] font-bold text-white shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white p-3 shadow-xl border border-[#D7E5DB] z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D7E5DB] mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#173C32]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#E5F5EA] text-[#075B46] font-semibold border border-[#D7E5DB]">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1 text-[11px] text-[#075B46] hover:underline font-medium"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#6B7C74]">
                        No notifications yet. Workflow updates will appear here.
                      </div>
                    ) : (
                      notifications.slice(0, 15).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkOneRead(n.id)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                            n.read
                              ? "bg-white border-[#D7E5DB] text-[#6B7C74]"
                              : "bg-[#EDF7EF] border-[#D7E5DB] text-[#173C32]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-semibold text-[#173C32] leading-tight">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-[#6B7C74] whitespace-nowrap">
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B7C74] mt-1 leading-normal">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User profile or login button */}
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to={`/${user.role.toLowerCase()}/dashboard`}
                className="hidden sm:flex flex-col text-right leading-tight"
              >
                <span className="text-xs font-bold text-[#173C32]">{user.fullName}</span>
                <span className="text-[10px] text-[#075B46] font-mono uppercase font-semibold">{user.role}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-xl bg-[#EDF7EF] border border-[#D7E5DB] text-[#6B7C74] hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login/admin"
              className="px-4 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-medium text-xs shadow-sm transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
