import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth, Role } from "../../context/AuthContext";
import {
  ShieldCheck,
  Recycle,
  Truck,
  Building2,
  Wrench,
  UserCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  KeyRound,
} from "lucide-react";

interface RoleConfig {
  role: Role;
  title: string;
  subtitle: string;
  icon: any;
  email: string;
  color: string;
  dashPath: string;
}

export const LoginPage: React.FC = () => {
  const { roleParam } = useParams<{ roleParam: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  const role = (roleParam?.toUpperCase() as Role) || "ADMIN";

  const roleConfigs: Record<Role, RoleConfig> = {
    ADMIN: {
      role: "ADMIN",
      title: "Regulatory & Audit Portal",
      subtitle: "National E-Waste Audit & Mass-Balance Oversight Tower",
      icon: ShieldCheck,
      email: "admin@ecotrace.org",
      color: "from-purple-500 to-indigo-600 text-purple-400",
      dashPath: "/admin/dashboard",
    },
    DEALER: {
      role: "DEALER",
      title: "Dealer & Collector Portal",
      subtitle: "Waste Aggregation, Initial Weighing & Dispatch Registry",
      icon: Recycle,
      email: "dealer@metrocollect.com",
      color: "from-emerald-500 to-teal-600 text-emerald-400",
      dashPath: "/dealer/dashboard",
    },
    DRIVER: {
      role: "DRIVER",
      title: "Transporter & Driver Portal",
      subtitle: "Assigned Trips, Transit Status & Handover Verifications",
      icon: Truck,
      email: "driver@greenlogistics.com",
      color: "from-blue-500 to-cyan-600 text-blue-400",
      dashPath: "/driver/dashboard",
    },
    FACTORY: {
      role: "FACTORY",
      title: "Factory Receiving Portal",
      subtitle: "Weighbridge Measurement, Quality Intake & Discrepancy Audits",
      icon: Building2,
      email: "factory@apexrecycling.com",
      color: "from-amber-500 to-orange-600 text-amber-400",
      dashPath: "/factory/dashboard",
    },
    WORKER: {
      role: "WORKER",
      title: "Recycling & Processing Portal",
      subtitle: "Mass-Balance Calculator, Material Recovery & Refurbishment",
      icon: Wrench,
      email: "worker@apexrecycling.com",
      color: "from-emerald-500 to-lime-600 text-emerald-300",
      dashPath: "/worker/dashboard",
    },
    CUSTOMER: {
      role: "CUSTOMER",
      title: "Customer & Provenance Portal",
      subtitle: "Refurbished Product Verifier, Ownership & Service Logs",
      icon: UserCheck,
      email: "customer@ecotrace.org",
      color: "from-teal-500 to-emerald-600 text-teal-400",
      dashPath: "/customer/dashboard",
    },
  };

  const config = roleConfigs[role] || roleConfigs.ADMIN;
  const Icon = config.icon;

  const [email, setEmail] = useState(config.email);
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password, config.role);
      navigate(config.dashPath);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCreds = () => {
    setEmail(config.email);
    setPassword("password123");
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-slate-800 shadow-2xl relative">
        {/* Glow backdrop */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-emerald-500/10 blur-3xl rounded-full -z-10" />

        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner mb-2">
            <Icon className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{config.title}</h2>
          <p className="text-xs text-slate-400">{config.subtitle}</p>
        </div>

        {/* Demo Creds Shortcut Pill */}
        <div className="mb-6 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <p className="text-slate-400 text-[11px]">Seeded Test Account:</p>
            <p className="font-mono text-emerald-400 font-medium">{config.email}</p>
          </div>
          <button
            type="button"
            onClick={fillDemoCreds}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-medium transition-colors"
          >
            <KeyRound className="w-3 h-3" />
            <span>Auto Fill</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Authenticating & Verifying Role..." : `Sign In to ${config.role} Portal`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Other Portals Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400 mb-2">Need to access another role portal?</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono">
            {(["ADMIN", "DEALER", "DRIVER", "FACTORY", "WORKER", "CUSTOMER"] as Role[]).map((r) => (
              <Link
                key={r}
                to={`/login/${r.toLowerCase()}`}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  r === config.role
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {r}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
