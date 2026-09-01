"use client";

import { useCallback } from "react";
import { stockApi, type SupplierReturn } from "@/lib/api/stock";
import { useApiQueryFn } from "./use-api-query";

export function useSupplierReturnsList(statusFilter = "") {
  const fetcher = useCallback(async (): Promise<SupplierReturn[]> => {
    const res = await stockApi.listSupplierReturns(statusFilter || undefined);
    return res.items ?? [];
  }, [statusFilter]);
  return useApiQueryFn(fetcher, { deps: [statusFilter] });
}
