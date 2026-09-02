"use client";

/**
 * @file use-customers-list.ts
 * @description Lista clientes; por padrão só ativos (activeOnly=true).
 * @consumers clientes/page.tsx, cotacoes/nova/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

type CustomersListParams = {
  limit?: number;
  offset?: number;
  q?: string;
};

export function useCustomersList(activeOnly = true, params?: CustomersListParams) {
  const limit = params?.limit;
  const offset = params?.offset;
  const q = params?.q;
  const fetcher = useCallback(
    () => salesApi.listCustomers({ activeOnly, limit, offset, q }),
    [activeOnly, limit, offset, q],
  );
  return useApiQueryFn(fetcher, { deps: [activeOnly, limit, offset, q] });
}
