"use client";

/**
 * @file use-pim-list-queries.ts
 * @description Consultas de catálogo: produtos+SKUs, lista de SKUs e categorias.
 * @consumers produtos/page.tsx, precos/page.tsx, cadastros/page.tsx, categorias/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-pim-list-queries.ts
 * @description Consultas de catálogo: produtos+SKUs, lista de SKUs e categorias.
 * @consumers produtos/page.tsx, precos/page.tsx, cadastros/page.tsx, categorias/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import type { Product, SKU } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type ProductCatalog = {
  productsById: Record<string, Product>;
  skus: SKU[];
  total: number;
};

const SKUS_PAGE_SIZE = 30;

export function useProductCatalog(query = "", offset = 0, limit = SKUS_PAGE_SIZE) {
  const fetcher = useCallback(async (): Promise<ProductCatalog> => {
    const qParam = query.trim() || undefined;
    const [p, s] = await Promise.all([
      pimApi.listProducts({ q: qParam, limit: 200 }),
      pimApi.listAllSkus({ q: qParam, limit, offset }),
    ]);
    const productsById: Record<string, Product> = {};
    for (const product of p.items) productsById[product.id] = product;
    return { productsById, skus: s.items ?? [], total: s.total ?? s.items?.length ?? 0 };
  }, [query, offset, limit]);
  return useApiQueryFn(fetcher, { deps: [query, offset, limit] });
}

export { SKUS_PAGE_SIZE };

export function useSkusList(query = "") {
  const fetcher = useCallback(async () => {
    const res = await pimApi.listAllSkus({ q: query.trim() || undefined });
    return res.items ?? [];
  }, [query]);
  return useApiQueryFn(fetcher, { deps: [query] });
}

export function useCategoriesList(activeOnly = false) {
  const fetcher = useCallback(async () => {
    const res = await pimApi.listCategories(activeOnly);
    return res.items ?? [];
  }, [activeOnly]);
  return useApiQueryFn(fetcher, { deps: [activeOnly] });
}
