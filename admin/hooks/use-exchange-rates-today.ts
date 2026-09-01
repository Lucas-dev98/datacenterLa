"use client";

import { useCallback } from "react";
import { pricingApi } from "@/lib/api/pricing";
import { useApiQueryFn } from "./use-api-query";

export function useExchangeRatesToday() {
  const fetcher = useCallback(() => pricingApi.exchangeRatesToday(), []);
  return useApiQueryFn(fetcher);
}
