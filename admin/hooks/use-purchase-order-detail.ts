"use client";

import { useCallback } from "react";
import { purchasesApi, type PurchaseOrderDetail } from "@/lib/api/purchases";
import { useApiQueryFn } from "./use-api-query";

export function usePurchaseOrderDetail(poId: string) {
  const fetcher = useCallback(() => purchasesApi.getOrder(poId), [poId]);
  return useApiQueryFn<PurchaseOrderDetail>(fetcher, { deps: [poId], enabled: Boolean(poId) });
}
