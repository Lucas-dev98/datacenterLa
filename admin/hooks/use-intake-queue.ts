"use client";

/**
 * @file use-intake-queue.ts
 * @description Fila de unidades em intake (recebimento → teste → estoque).
 * @consumers estoque/entrada/recebimento/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-intake-queue.ts
 * @description Fila de unidades em intake (recebimento → teste → estoque).
 * @consumers estoque/entrada/recebimento/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
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
