"use client";

/**
 * @file use-customer-returns-list.ts
 * @description Lista devoluções de clientes; aceita termo de busca.
 * @consumers devolucoes/page.tsx
 * @remarks Debounce do termo fica na página (300 ms).
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-customer-returns-list.ts
 * @description Lista devoluções de clientes; aceita termo de busca.
 * @consumers devolucoes/page.tsx
 * @remarks Debounce do termo fica na página (300 ms).
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { returnsApi, type CustomerReturn } from "@/lib/api/returns";
import { useApiQueryFn } from "./use-api-query";

export function useCustomerReturnsList(query = "") {
  const fetcher = useCallback(async (): Promise<CustomerReturn[]> => {
    const res = await returnsApi.list(query.trim());
    return res.items ?? [];
  }, [query]);
  return useApiQueryFn(fetcher, { deps: [query] });
}
