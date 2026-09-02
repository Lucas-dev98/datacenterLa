"use client";

/**
 * @file use-inventory-unit.ts
 * @description Detalhe de unidade física por código AAA.
 * @consumers estoque/unidades/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-inventory-unit.ts
 * @description Detalhe de unidade física por código AAA.
 * @consumers estoque/unidades/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import type { InventoryUnitDetail } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useInventoryUnitByCode(code: string, enabled = true) {
  const fetcher = useCallback(async (): Promise<InventoryUnitDetail> => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) throw new Error("Informe o código AAA");
    return stockApi.unitDetailByCode(normalized);
  }, [code]);
  return useApiQueryFn(fetcher, {
    deps: [code],
    enabled: enabled && Boolean(code.trim()),
  });
}
