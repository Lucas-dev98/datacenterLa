"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { canAccessRoute } from "@/lib/route-access";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!canAccessRoute(pathname, user)) {
      router.replace("/forbidden");
    }
  }, [loading, pathname, router, user]);

  if (!loading && !canAccessRoute(pathname, user)) {
    return null;
  }

  return <>{children}</>;
}
