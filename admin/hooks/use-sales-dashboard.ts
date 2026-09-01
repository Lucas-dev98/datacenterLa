"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import type { DashboardData } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useSalesDashboard() {
  const fetcher = useCallback(() => salesApi.dashboard(), []);
  return useApiQueryFn<DashboardData>(fetcher);
}
