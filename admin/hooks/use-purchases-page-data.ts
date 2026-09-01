"use client";

import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import { purchasesApi, type PurchaseOrderSummary, type Supplier } from "@/lib/api/purchases";
import type { SKU } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type PurchasesPageData = {
  suppliers: Supplier[];
  orders: PurchaseOrderSummary[];
  skus: SKU[];
};

export function usePurchasesPageData() {
  const fetcher = useCallback(async (): Promise<PurchasesPageData> => {
    const [s, o, skuRes] = await Promise.all([
      purchasesApi.listSuppliers(),
      purchasesApi.listOrders(),
      pimApi.listAllSkus(),
    ]);
    return {
      suppliers: s.items ?? [],
      orders: o.items ?? [],
      skus: skuRes.items ?? [],
    };
  }, []);
  return useApiQueryFn(fetcher, { deps: [] });
}
