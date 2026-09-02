"use client";

/**
 * @file use-stock-health-dashboard.ts
 * @description Painel de saúde: reservas órfãs, divergências, alertas.
 * @consumers estoque/saude/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-stock-health-dashboard.ts
 * @description Painel de saúde: reservas órfãs, divergências, alertas.
 * @consumers estoque/saude/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi, type HealthIssue, type HealthStats, type ExpiringReservation } from "@/lib/api/stock";
import { useApiQueryFn } from "./use-api-query";

export type StockHealthDashboard = {
  stats: HealthStats;
  expiring: ExpiringReservation[];
  issues: HealthIssue[];
};

export function useStockHealthDashboard() {
  const fetcher = useCallback(async (): Promise<StockHealthDashboard> => {
    const data = await stockApi.healthDashboard();
    return {
      stats: data.stats,
      expiring: data.expiring_reservations ?? [],
      issues: data.open_issues ?? [],
    };
  }, []);
  return useApiQueryFn(fetcher, { deps: [] });
}
