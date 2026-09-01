"use client";

import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import type { LowStockSKU, StockBalanceRow } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

type StockPositionInput = {
  lowStockMode: boolean;
  query: string;
  threshold: number;
};

export type StockPositionData = {
  items: StockBalanceRow[];
  lowStockItems: LowStockSKU[];
  total: number;
};

export function useStockPosition({ lowStockMode, query, threshold }: StockPositionInput) {
  const fetcher = useCallback(async (): Promise<StockPositionData> => {
    const q = query.trim() || undefined;
    if (lowStockMode) {
      const res = await stockApi.listLowStock({ threshold, q });
      return {
        items: [],
        lowStockItems: res.items ?? [],
        total: res.total ?? 0,
      };
    }
    const res = await stockApi.listBalances({ q });
    return {
      items: res.items ?? [],
      lowStockItems: [],
      total: res.total ?? 0,
    };
  }, [lowStockMode, query, threshold]);
  return useApiQueryFn(fetcher, { deps: [lowStockMode, query, threshold] });
}
