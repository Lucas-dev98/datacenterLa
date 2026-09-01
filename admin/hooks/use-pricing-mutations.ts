"use client";

import { useCallback } from "react";
import { pricingApi } from "@/lib/api/pricing";
import { useApiMutation } from "./use-api-mutation";

type SetSkuPriceInput = {
  skuId: string;
  body: Record<string, number>;
};

export function useSetSkuPrice() {
  const mutate = useCallback(
    ({ skuId, body }: SetSkuPriceInput) => pricingApi.setSkuPrice(skuId, body),
    [],
  );
  return useApiMutation(mutate);
}

export function useSyncExchangeRates() {
  const mutate = useCallback((_body: Record<string, never>) => pricingApi.syncExchangeRates(), []);
  return useApiMutation(mutate);
}
