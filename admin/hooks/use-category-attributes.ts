"use client";

/**
 * @file use-category-attributes.ts
 * @description Lista atributos configurados de uma categoria PIM.
 * @consumers categorias/[id]/page.tsx, produtos/[id]/page.tsx (via useProductDetail)
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import type { CategoryAttribute } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useCategoryAttributes(categoryId: string) {
  const fetcher = useCallback(async (): Promise<CategoryAttribute[]> => {
    const res = await pimApi.listCategoryAttributes(categoryId);
    return res.items ?? [];
  }, [categoryId]);
  return useApiQueryFn(fetcher, { deps: [categoryId], enabled: Boolean(categoryId) });
}
