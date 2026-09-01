"use client";

import { useCallback } from "react";
import { purchasesApi } from "@/lib/api/purchases";
import { useApiQueryFn } from "./use-api-query";

export function usePendingReceiveOrders() {
  const fetcher = useCallback(() => purchasesApi.listPendingReceiveOrders(), []);
  return useApiQueryFn(fetcher);
}
