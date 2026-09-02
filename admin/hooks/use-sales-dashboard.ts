"use client";

/**
 * @file use-sales-dashboard.ts
 * @description Dashboard operacional: vendas do mês, fila expedição, estoque baixo.
 * @consumers page.tsx (home admin)
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-sales-dashboard.ts
 * @description Dashboard operacional: vendas do mês, fila expedição, estoque baixo.
 * @consumers page.tsx (home admin)
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import type { DashboardData } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useSalesDashboard() {
  const fetcher = useCallback(() => salesApi.dashboard(), []);
  return useApiQueryFn<DashboardData>(fetcher);
}
