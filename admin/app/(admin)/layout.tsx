"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { RouteGuard } from "@/components/route-guard";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast-provider";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Carregando…
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"
          aria-expanded={mobileNavOpen}
          aria-controls="admin-mobile-nav"
          aria-label={mobileNavOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          {mobileNavOpen ? "×" : "☰"}
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Admin ERP</p>
          <p className="truncate text-[11px] text-slate-500">Data Center LA</p>
        </div>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <Sidebar
        id="admin-mobile-nav"
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onNavigate={() => setMobileNavOpen(false)}
      />

      <main className="flex-1 overflow-auto p-4 pt-[4.5rem] lg:p-8 lg:pt-8">
        <RouteGuard>{children}</RouteGuard>
      </main>
    </div>
    </ToastProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
