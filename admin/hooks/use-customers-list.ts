"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

export function useCustomersList(activeOnly = true) {
  const fetcher = useCallback(() => salesApi.listCustomers(activeOnly), [activeOnly]);
  return useApiQueryFn(fetcher, { deps: [activeOnly] });
}
