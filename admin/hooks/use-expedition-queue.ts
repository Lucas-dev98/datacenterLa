"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import type { OrderListItem } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useExpeditionQueue() {
  const fetcher = useCallback(async (): Promise<OrderListItem[]> => salesApi.listExpeditionQueue(), []);
  return useApiQueryFn(fetcher, { deps: [] });
}
