"use client";

import { useCallback } from "react";
import { financeApi } from "@/lib/api/finance";
import { useApiQueryFn } from "./use-api-query";

export function useFinanceDashboard(status = "open") {
  const fetcher = useCallback(() => financeApi.loadDashboard(status), [status]);
  return useApiQueryFn(fetcher, { deps: [status] });
}
