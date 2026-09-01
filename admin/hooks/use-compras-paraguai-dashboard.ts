"use client";

import { useCallback } from "react";
import { integrationsApi } from "@/lib/api/integrations";
import type { FeedDiagnostics, FeedSyncLog } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type ComprasParaguaiDashboard = {
  logs: FeedSyncLog[];
  diagnostics: FeedDiagnostics;
};

export function useComprasParaguaiDashboard(logLimit = 30) {
  const fetcher = useCallback(async (): Promise<ComprasParaguaiDashboard> => {
    const [logsRes, diagnostics] = await Promise.all([
      integrationsApi.listSyncLogs(logLimit),
      integrationsApi.getSyncDiagnostics(),
    ]);
    return {
      logs: logsRes.items ?? [],
      diagnostics,
    };
  }, [logLimit]);
  return useApiQueryFn(fetcher, { deps: [logLimit] });
}
