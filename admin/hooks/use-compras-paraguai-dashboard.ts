"use client";

/**
 * @file use-compras-paraguai-dashboard.ts
 * @description Logs de sync e diagnóstico do feed Compras Paraguai.
 * @consumers integracoes/compras-paraguai/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
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
