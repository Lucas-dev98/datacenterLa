"use client";

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
