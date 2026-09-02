"use client";

/**
 * @file use-pricing-mutations.ts
 * @description Define preços USD do SKU e sincroniza câmbio.
 * @consumers precos/page.tsx, produtos/[id]/page.tsx, financeiro/cotacoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-pricing-mutations.ts
 * @description Define preços USD do SKU e sincroniza câmbio.
 * @consumers precos/page.tsx, produtos/[id]/page.tsx, financeiro/cotacoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
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
