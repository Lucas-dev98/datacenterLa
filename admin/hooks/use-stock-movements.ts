"use client";

/**
 * @file use-stock-movements.ts
 * @description Movimentações de estoque paginadas com filtros.
 * @consumers estoque/movimentacoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import type { StockMovementRow } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type StockMovementsPage = {
  items: StockMovementRow[];
  total: number;
};

type StockMovementsInput = {
  q: string;
  movementType: string;
  offset: number;
  limit?: number;
};

export function useStockMovements({ q, movementType, offset, limit = 50 }: StockMovementsInput) {
  const fetcher = useCallback(async (): Promise<StockMovementsPage> => {
    const res = await stockApi.listMovements({
      q: q.trim() || undefined,
      movement_type: movementType || undefined,
      offset,
      limit,
    });
    return { items: res.items ?? [], total: res.total ?? 0 };
  }, [limit, movementType, offset, q]);
  return useApiQueryFn(fetcher, { deps: [q, movementType, offset] });
}
