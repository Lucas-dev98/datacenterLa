"use client";

/**
 * @file use-sku-search.ts
 * @description Busca SKUs por termo; só dispara com ≥2 caracteres.
 * @consumers etiquetas/page.tsx
 * @remarks enabled=false enquanto termo curto — evita spam na API.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import type { SKU } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useSkuSearch(query: string, limit = 20) {
  const fetcher = useCallback(async (): Promise<SKU[]> => {
    const term = query.trim();
    if (term.length < 2) return [];
    const res = await pimApi.searchSkus(term, limit);
    return res.items ?? [];
  }, [limit, query]);
  return useApiQueryFn(fetcher, {
    deps: [query],
    enabled: query.trim().length >= 2,
  });
}
