"use client";

/**
 * @file use-orders-list.ts
 * @description Lista pedidos com filtro opcional de status.
 * @consumers pedidos/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-orders-list.ts
 * @description Lista pedidos com filtro opcional de status.
 * @consumers pedidos/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

type Options = {
  status?: string;
  limit?: number;
};

export function useOrdersList({ status = "", limit = 50 }: Options = {}) {
  const fetcher = useCallback(
    () => salesApi.listOrders({ limit, status: status || undefined }),
    [limit, status],
  );
  return useApiQueryFn(fetcher, { deps: [status, limit] });
}
