"use client";

import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import type { SKU } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useSkuSearch(query: string, limit = 20) {
  const fetcher = useCallback(async (): Promise<SKU[]> => {
    const term = query.trim();
    if (term.length < 2) return [];
    const res = await pimApi.searchSkus(term, limit);
    return res.items ?? [];
  }, [limit, query]);
  return useApiQueryFn(fetcher, {
    deps: [query],
    enabled: query.trim().length >= 2,
  });
}
