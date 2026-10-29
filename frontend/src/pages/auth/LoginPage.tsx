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

  React.useEffect(() => {
    setEmail(config.email);
    setPassword("password123");
    setError(null);
  }, [config.email]);

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
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12 bg-[#F7FBF7]">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#D7E5DB] shadow-md relative">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] shadow-sm mb-2">
            <Icon className="w-8 h-8 text-[#075B46] stroke-[2]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#173C32] tracking-tight">{config.title}</h2>
          <p className="text-xs text-[#6B7C74] font-sans">{config.subtitle}</p>
        </div>

        {/* Demo Creds Shortcut Pill */}
        <div className="mb-6 p-3.5 rounded-2xl bg-[#EDF7EF] border border-[#D7E5DB] flex items-center justify-between text-xs">
          <div>
            <p className="text-[#6B7C74] text-[11px] font-medium">Seeded Test Account:</p>
            <p className="font-mono text-[#075B46] font-semibold">{config.email}</p>
          </div>
          <button
            type="button"
            onClick={fillDemoCreds}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E5F5EA] text-[#075B46] hover:bg-[#D7E5DB] border border-[#D7E5DB] text-[11px] font-semibold transition-colors shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#075B46]" />
            <span>Auto Fill</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#173C32] mb-1.5 font-sans">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6B7C74] absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#173C32] placeholder-[#6B7C74]/60 focus:outline-none focus:border-[#075B46] focus:ring-1 focus:ring-[#075B46] transition-colors shadow-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#173C32] mb-1.5 font-sans">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B7C74] absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#D7E5DB] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#173C32] placeholder-[#6B7C74]/60 focus:outline-none focus:border-[#075B46] focus:ring-1 focus:ring-[#075B46] transition-colors shadow-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold text-xs shadow-sm hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Authenticating & Verifying Role..." : `Sign In to ${config.role} Portal`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Other Portals Switcher */}
        <div className="mt-8 pt-6 border-t border-[#D7E5DB] text-center">
          <p className="text-xs text-[#6B7C74] mb-2 font-sans">Need to access another role portal?</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono">
            {(["ADMIN", "DEALER", "DRIVER", "FACTORY", "WORKER", "CUSTOMER"] as Role[]).map((r) => (
              <Link
                key={r}
                to={`/login/${r.toLowerCase()}`}
                className={`px-2.5 py-1 rounded-lg border transition-colors ${
                  r === config.role
                    ? "bg-[#E5F5EA] text-[#075B46] border-[#D7E5DB] font-bold"
                    : "bg-[#EDF7EF] text-[#6B7C74] border-[#D7E5DB] hover:text-[#173C32]"
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
