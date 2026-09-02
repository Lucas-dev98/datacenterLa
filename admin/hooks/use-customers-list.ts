"use client";

/**
 * @file use-customers-list.ts
 * @description Lista clientes; por padrão só ativos (activeOnly=true).
 * @consumers clientes/page.tsx, cotacoes/nova/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
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

export function useCustomersList(activeOnly = true) {
  const fetcher = useCallback(() => salesApi.listCustomers(activeOnly), [activeOnly]);
  return useApiQueryFn(fetcher, { deps: [activeOnly] });
}
