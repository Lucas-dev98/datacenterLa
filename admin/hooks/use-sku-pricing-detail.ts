"use client";

import { useCallback } from "react";
import { pricingApi } from "@/lib/api/pricing";
import type { ResolvedPrice, SKUPrice } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type SkuPricingDetail = {
  price: SKUPrice;
  resolved: ResolvedPrice[];
};

export function useSkuPricingDetail(skuId: string | null) {
  const fetcher = useCallback(async (): Promise<SkuPricingDetail> => {
    if (!skuId) throw new Error("SKU obrigatório");
    const price = await pricingApi.getSkuPrice(skuId);
    const channels = ["b2c", "b2b", "reseller"];
    const resolvedPrices = await Promise.all(
      channels.map((ch) => pricingApi.resolve(skuId, ch).catch(() => null)),
    );
    return {
      price,
      resolved: resolvedPrices.filter((r): r is ResolvedPrice => Boolean(r)),
    };
  }, [skuId]);
  return useApiQueryFn(fetcher, { deps: [skuId], enabled: Boolean(skuId) });
}
