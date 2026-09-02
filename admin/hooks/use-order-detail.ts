"use client";

/**
 * @file use-order-detail.ts
 * @description Carrega pedido e cliente; expõe setOrder para atualização otimista.
 * @consumers pedidos/[id]/page.tsx, components/ship-expedition-modal.tsx
 * @remarks Cliente é opcional — falha silenciosa se getCustomer falhar.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import type { Customer, Order } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

type OrderDetailData = {
  order: Order;
  customer: Customer | null;
};

export function useOrderDetail(orderId: string) {
  const fetcher = useCallback(async (): Promise<OrderDetailData> => {
    const order = await salesApi.getOrder(orderId);
    let customer: Customer | null = null;
    if (order.customer_id) {
      try {
        customer = await salesApi.getCustomer(order.customer_id);
      } catch {
        customer = null;
      }
    }
    return { order, customer };
  }, [orderId]);

  const { data, error, loading, refetch, setData } = useApiQueryFn(fetcher, {
    deps: [orderId],
    enabled: Boolean(orderId),
  });

  /** Atualiza o pedido em memória após mutation sem refetch completo. */
  const setOrder = useCallback(
    (order: Order) => {
      setData((prev) => (prev ? { ...prev, order } : { order, customer: null }));
    },
    [setData],
  );

  return {
    order: data?.order ?? null,
    customer: data?.customer ?? null,
    data: data?.order ?? null,
    error,
    loading,
    refetch,
    setOrder,
    setData,
  };
}
