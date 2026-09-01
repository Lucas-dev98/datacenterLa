"use client";

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
