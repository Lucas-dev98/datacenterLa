"use client";

/**
 * @file use-rma-cases-list.ts
 * @description Lista casos RMA com busca opcional.
 * @consumers rma/page.tsx
 * @remarks Debounce do termo fica na página (300 ms).
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-rma-cases-list.ts
 * @description Lista casos RMA com busca opcional.
 * @consumers rma/page.tsx
 * @remarks Debounce do termo fica na página (300 ms).
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { rmaApi, type RMACase } from "@/lib/api/rma";
import { useApiQueryFn } from "./use-api-query";

export function useRmaCasesList(query = "") {
  const fetcher = useCallback(async (): Promise<RMACase[]> => {
    const res = await rmaApi.list(query.trim());
    return res.items ?? [];
  }, [query]);
  return useApiQueryFn(fetcher, { deps: [query] });
}
