"use client";

import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { IntakeQueueItem } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useIntakeQueue(warehouseId = DEFAULT_WAREHOUSE_ID, limit = 200) {
  const fetcher = useCallback(async (): Promise<IntakeQueueItem[]> => {
    const res = await stockApi.intakeQueue(warehouseId, limit);
    return res.items ?? [];
  }, [limit, warehouseId]);
  return useApiQueryFn(fetcher, { deps: [warehouseId, limit] });
}
