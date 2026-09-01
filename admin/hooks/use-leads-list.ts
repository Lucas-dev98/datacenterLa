"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

export function useLeadsList() {
  const fetcher = useCallback(async () => {
    const res = await salesApi.listLeads();
    return res.items ?? [];
  }, []);
  return useApiQueryFn(fetcher);
}
