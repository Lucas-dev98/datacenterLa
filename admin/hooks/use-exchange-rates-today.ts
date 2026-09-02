"use client";

/**
 * @file use-exchange-rates-today.ts
 * @description Cotações de câmbio vigentes no dia.
 * @consumers financeiro/cotacoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { pricingApi } from "@/lib/api/pricing";
import { useApiQueryFn } from "./use-api-query";

export function useExchangeRatesToday() {
  const fetcher = useCallback(() => pricingApi.exchangeRatesToday(), []);
  return useApiQueryFn(fetcher);
}
