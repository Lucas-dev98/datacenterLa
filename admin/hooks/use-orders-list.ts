"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

type Options = {
  status?: string;
  limit?: number;
};

export function useOrdersList({ status = "", limit = 50 }: Options = {}) {
  const fetcher = useCallback(
    () => salesApi.listOrders({ limit, status: status || undefined }),
    [limit, status],
  );
  return useApiQueryFn(fetcher, { deps: [status, limit] });
}
