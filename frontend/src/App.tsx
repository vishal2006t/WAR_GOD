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
        <div className="w-10 h-10 border-4 border-[#075B46]/20 border-t-[#075B46] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const fallbackRole = allowedRoles[0]?.toLowerCase() || "admin";
    return <Navigate to={`/login/${fallbackRole}`} state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 glass-card rounded-2xl border border-rose-200 text-center space-y-4 shadow-card">
        <h3 className="text-xl font-serif text-[#173C32]">Access Denied</h3>
        <p className="text-xs text-[#6B7C74]">
          Your current account role <code className="text-[#075B46] font-bold">{user.role}</code> is not authorized for this portal.
        </p>
        <p className="text-xs text-[#6B7C74]">Required: {allowedRoles.join(", ")}</p>
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

const PublicVerifyWrapper: React.FC = () => {
  const { user } = useAuth();
  if (user) {
    return (
      <div className="flex">
        <RoleSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto">
          <PublicVerifyPage />
        </main>
      </div>
    );
  }
  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <PublicVerifyPage />
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7FBF7] text-[#173C32] flex flex-col">
      <Navbar />
      <div className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify" element={<PublicVerifyWrapper />} />

          {/* Role-Specific Login Routes & Shorthands */}
          <Route path="/login" element={<Navigate to="/login/admin" replace />} />
          <Route path="/driver/login" element={<Navigate to="/login/driver" replace />} />
          <Route path="/dealer/login" element={<Navigate to="/login/dealer" replace />} />
          <Route path="/factory/login" element={<Navigate to="/login/factory" replace />} />
          <Route path="/login/:roleParam" element={<LoginPage />} />

          {/* Direct Portal Shorthands */}
          <Route path="/driver" element={<Navigate to="/driver/dashboard" replace />} />
          <Route path="/dealer" element={<Navigate to="/dealer/dashboard" replace />} />
          <Route path="/factory" element={<Navigate to="/factory/dashboard" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/worker" element={<Navigate to="/worker/dashboard" replace />} />
          <Route path="/customer" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/marketplace" element={<Navigate to="/customer/dashboard#marketplace" replace />} />

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
