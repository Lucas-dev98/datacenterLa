"use client";

import { useCallback } from "react";
import { returnsApi, type CustomerReturn } from "@/lib/api/returns";
import { useApiQueryFn } from "./use-api-query";

export function useCustomerReturnsList(query = "") {
  const fetcher = useCallback(async (): Promise<CustomerReturn[]> => {
    const res = await returnsApi.list(query.trim());
    return res.items ?? [];
  }, [query]);
  return useApiQueryFn(fetcher, { deps: [query] });
}
