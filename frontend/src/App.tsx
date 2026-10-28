import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth, Role } from "./context/AuthContext";
import { Navbar } from "./components/layout/Navbar";
import { RoleSidebar } from "./components/layout/RoleSidebar";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { PublicVerifyPage } from "./pages/PublicVerifyPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { DealerDashboard } from "./pages/dealer/DealerDashboard";
import { DriverDashboard } from "./pages/driver/DriverDashboard";
import { FactoryDashboard } from "./pages/factory/FactoryDashboard";
import { WorkerDashboard } from "./pages/worker/WorkerDashboard";
import { CustomerDashboard } from "./pages/customer/CustomerDashboard";

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const fallbackRole = allowedRoles[0]?.toLowerCase() || "admin";
    return <Navigate to={`/login/${fallbackRole}`} state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 glass-card rounded-2xl border border-rose-500/40 text-center space-y-4">
        <h3 className="text-xl font-bold text-white">Access Denied</h3>
        <p className="text-xs text-slate-300">
          Your current account role <code className="text-emerald-400 font-bold">{user.role}</code> is not authorized for this portal.
        </p>
        <p className="text-xs text-slate-400">Required: {allowedRoles.join(", ")}</p>
        <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />
      </div>
    );
  }

  return (
    <div className="flex">
      <RoleSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col">
      <Navbar />
      <div className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify" element={<PublicVerifyPage />} />

          {/* 6 Role-Specific Login Routes */}
          <Route path="/login/:roleParam" element={<LoginPage />} />

          {/* 6 Role-Specific Protected Dashboards */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dealer/dashboard"
            element={
              <ProtectedRoute allowedRoles={["DEALER", "ADMIN"]}>
                <DealerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/driver/dashboard"
            element={
              <ProtectedRoute allowedRoles={["DRIVER", "ADMIN"]}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/factory/dashboard"
            element={
              <ProtectedRoute allowedRoles={["FACTORY", "ADMIN"]}>
                <FactoryDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/worker/dashboard"
            element={
              <ProtectedRoute allowedRoles={["WORKER", "ADMIN"]}>
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer/dashboard"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER", "ADMIN"]}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
