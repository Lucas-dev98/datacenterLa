"use client";

/**
 * @file use-purchase-order-detail.ts
 * @description Detalhe de pedido de compra (fornecedor, linhas, status).
 * @consumers compras/[id]/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { purchasesApi, type PurchaseOrderDetail } from "@/lib/api/purchases";
import { useApiQueryFn } from "./use-api-query";

export function usePurchaseOrderDetail(poId: string) {
  const fetcher = useCallback(() => purchasesApi.getOrder(poId), [poId]);
  return useApiQueryFn<PurchaseOrderDetail>(fetcher, { deps: [poId], enabled: Boolean(poId) });
}
