"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import {
  clearTokens,
  getStoredUser,
  isAuthenticated,
  saveUser,
  syncSessionCookie,
} from "@/lib/auth";
import type { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = async () => {
    if (!isAuthenticated()) {
      setUser(null);
      return;
    }
    const me = await authApi.me();
    saveUser(me);
    setUser(me);
  };

  useEffect(() => {
    const boot = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        if (pathname !== "/login") router.replace("/login");
        return;
      }
      syncSessionCookie();
      try {
        const cached = getStoredUser();
        if (cached) setUser(cached);
        await refreshUser();
        const me = getStoredUser();
        if (
          me &&
          !me.mfa_enabled &&
          localStorage.getItem("dcla_mfa_setup") === "1" &&
          pathname !== "/configuracoes/seguranca"
        ) {
          router.replace("/configuracoes/seguranca");
        }
      } catch {
        clearTokens();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    clearTokens();
    setUser(null);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
