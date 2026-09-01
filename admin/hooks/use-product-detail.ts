"use client";

import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import type { CategoryAttribute, Product, SKU } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type ProductDetail = {
  product: Product;
  sku: SKU | null;
  categoryAttributes: CategoryAttribute[];
};

export function useProductDetail(productId: string) {
  const fetcher = useCallback(async (): Promise<ProductDetail> => {
    const product = await pimApi.getProduct(productId);
    const categoryAttributes = product.category_id
      ? (await pimApi.listCategoryAttributes(product.category_id)).items ?? []
      : [];
    return {
      product,
      sku: product.skus?.[0] ?? null,
      categoryAttributes,
    };
  }, [productId]);
  return useApiQueryFn(fetcher, { deps: [productId], enabled: Boolean(productId) });
}
