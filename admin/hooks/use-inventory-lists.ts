"use client";

/**
 * @file use-inventory-lists.ts
 * @description Contagens de inventário e ajustes pendentes/aprovados.
 * @consumers estoque/inventario/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-inventory-lists.ts
 * @description Contagens de inventário e ajustes pendentes/aprovados.
 * @consumers estoque/inventario/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi, type StockAdjustment, type StockCount } from "@/lib/api/stock";
import { useApiQueryFn } from "./use-api-query";

export type InventoryLists = {
  counts: StockCount[];
  adjustments: StockAdjustment[];
};

export function useInventoryLists() {
  const fetcher = useCallback(async (): Promise<InventoryLists> => {
    const [c, a] = await Promise.all([stockApi.listCounts(), stockApi.listAdjustments()]);
    return {
      counts: c.items ?? [],
      adjustments: a.items ?? [],
    };
  }, []);
  return useApiQueryFn(fetcher, { deps: [] });
}
