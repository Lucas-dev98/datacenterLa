"use client";

import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import { purchasesApi, type PurchaseOrderDetail } from "@/lib/api/purchases";
import type { SKU } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type PurchaseOrderReceiveState = {
  po: PurchaseOrderDetail;
  skuById: Record<string, SKU>;
};

export function usePurchaseOrderReceive(poId: string) {
  const fetcher = useCallback(async (): Promise<PurchaseOrderReceiveState> => {
    const po = await purchasesApi.getOrder(poId);
    const skuById = await pimApi.loadSkusByIds((po.items ?? []).map((i) => i.sku_id));
    return { po, skuById };
  }, [poId]);
  return useApiQueryFn(fetcher, { deps: [poId] });
}
