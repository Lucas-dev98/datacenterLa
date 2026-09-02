"use client";

/**
 * @file use-finance-dashboard.ts
 * @description Resumo financeiro: recebíveis, pagáveis e margens.
 * @consumers financeiro/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { financeApi } from "@/lib/api/finance";
import { useApiQueryFn } from "./use-api-query";

export function useFinanceDashboard(status = "open") {
  const fetcher = useCallback(() => financeApi.loadDashboard(status), [status]);
  return useApiQueryFn(fetcher, { deps: [status] });
}
