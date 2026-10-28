import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

export type Role = "ADMIN" | "DEALER" | "DRIVER" | "FACTORY" | "WORKER" | "CUSTOMER";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organization?: string;
  facility?: { id: string; name: string; code: string };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, portalRole?: string) => Promise<User>;
  logout: () => void;
  quickSwitch: (role: Role) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("ecotrace_token"));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.me();
          if (res.success && res.user) {
            setUser(res.user);
          } else {
            logout();
          }
        } catch (err) {
          console.error("Failed to authenticate session:", err);
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string, portalRole?: string): Promise<User> => {
    const res = await api.login({ email, password, portalRole });
    if (res.success && res.token && res.user) {
      localStorage.setItem("ecotrace_token", res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.error || "Login failed");
  };

  const logout = () => {
    localStorage.removeItem("ecotrace_token");
    setToken(null);
    setUser(null);
  };

  // Demo helper: quick login to test accounts
  const quickSwitch = async (role: Role) => {
    const roleEmails: Record<Role, string> = {
      ADMIN: "admin@ecotrace.org",
      DEALER: "dealer@metrocollect.com",
      DRIVER: "driver@greenlogistics.com",
      FACTORY: "factory@apexrecycling.com",
      WORKER: "worker@apexrecycling.com",
      CUSTOMER: "customer@ecotrace.org",
    };
    await login(roleEmails[role], "password123", role);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, quickSwitch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
