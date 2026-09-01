"use client";

import { useCallback } from "react";
import { useApiQueryFn } from "./use-api-query";
import { salesApi } from "@/lib/api/sales";
import type { Customer, Order } from "@/lib/types";

export function useOrderDetail(orderId: string) {
  const fetcher = useCallback(
    () => salesApi.getOrderWithCustomer(orderId),
    [orderId],
  );
  const { data, error, loading, refetch, setData } = useApiQueryFn(fetcher, {
    deps: [orderId],
  });

  const setOrder = (order: Order) => {
    setData((prev) => (prev ? { ...prev, order } : prev));
  };

  return {
    order: data?.order ?? null,
    customer: data?.customer ?? null,
    error,
    loading,
    refetch,
    setOrder,
  };
}

export type OrderDetailState = {
  order: Order | null;
  customer: Customer | null;
};
