"use client";

import { useCallback } from "react";
import { posApi, type ExchangeRatesToday } from "@/lib/api/pos";
import type { Customer } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type PdvBootstrap = {
  walkIn: Customer;
  exchangeRates: ExchangeRatesToday;
};

export function usePdvBootstrap() {
  const fetcher = useCallback(async (): Promise<PdvBootstrap> => {
    const [walkIn, exchangeRates] = await Promise.all([
      posApi.getWalkInCustomer(),
      posApi.getExchangeRates(),
    ]);
    return { walkIn, exchangeRates };
  }, []);
  return useApiQueryFn(fetcher);
}
