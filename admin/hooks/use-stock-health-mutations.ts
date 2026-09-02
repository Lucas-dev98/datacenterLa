"use client";

/**
 * @file use-stock-health-mutations.ts
 * @description Executa scan de saúde e marca issue como resolvida.
 * @consumers estoque/saude/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-stock-health-mutations.ts
 * @description Executa scan de saúde e marca issue como resolvida.
 * @consumers estoque/saude/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import { useApiMutation } from "./use-api-mutation";

export function useStockHealthScan() {
  const mutate = useCallback((_body: Record<string, never>) => stockApi.healthScan(), []);
  return useApiMutation(mutate);
}

export function useResolveStockHealthIssue() {
  const mutate = useCallback((id: string) => stockApi.resolveHealthIssue(id), []);
  return useApiMutation(mutate);
}
