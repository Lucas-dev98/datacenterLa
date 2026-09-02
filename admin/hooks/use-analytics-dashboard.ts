"use client";

/**
 * @file use-analytics-dashboard.ts
 * @description Dashboard de analytics de vendas (período, canal, produtos).
 * @consumers financeiro/analytics/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-analytics-dashboard.ts
 * @description Dashboard de analytics de vendas (período, canal, produtos).
 * @consumers financeiro/analytics/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import type { AnalyticsDashboard } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

type AnalyticsInput = {
  from: string;
  to: string;
  channel: string;
  metric: "revenue" | "quantity";
};

export function useAnalyticsDashboard({ from, to, channel, metric }: AnalyticsInput) {
  const fetcher = useCallback(async (): Promise<AnalyticsDashboard> => {
    return salesApi.analyticsDashboard({
      from,
      to,
      metric,
      channel: channel || undefined,
    });
  }, [channel, from, metric, to]);
  return useApiQueryFn(fetcher, { deps: [from, to, channel, metric] });
}
