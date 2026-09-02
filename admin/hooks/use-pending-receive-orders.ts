"use client";

/**
 * @file use-pending-receive-orders.ts
 * @description Pedidos de compra com linhas pendentes de recebimento.
 * @consumers estoque/entrada/compras/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { purchasesApi } from "@/lib/api/purchases";
import { useApiQueryFn } from "./use-api-query";

export function usePendingReceiveOrders() {
  const fetcher = useCallback(() => purchasesApi.listPendingReceiveOrders(), []);
  return useApiQueryFn(fetcher);
}
