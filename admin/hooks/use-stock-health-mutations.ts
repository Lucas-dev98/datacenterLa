"use client";

import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import { useApiMutation } from "./use-api-mutation";

export function useStockHealthScan() {
  const mutate = useCallback((_body: Record<string, never>) => stockApi.healthScan(), []);
  return useApiMutation(mutate);
}

export function useResolveStockHealthIssue() {
  const mutate = useCallback((id: string) => stockApi.resolveHealthIssue(id), []);
  return useApiMutation(mutate);
}
