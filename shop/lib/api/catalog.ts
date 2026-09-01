import { DEFAULT_WAREHOUSE_ID } from "../config";
import { cachedFetch } from "../catalog-cache";
import type { CatalogProduct, EcommerceCategory } from "../types";
import { api } from "./client";

const BASE = "/api/v1/ecommerce";

export async function fetchCatalog(
  warehouseId = DEFAULT_WAREHOUSE_ID,
  opts?: { categoryId?: string; q?: string },
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  if (opts?.categoryId) params.set("category_id", opts.categoryId);
  if (opts?.q) params.set("q", opts.q);
  const cacheKey = `catalog:${params.toString()}`;
  return cachedFetch(cacheKey, async () => {
    const res = await api<{ items: CatalogProduct[] }>(`${BASE}/catalog?${params}`);
    return res.items ?? [];
  });
}

export async function fetchCategories(): Promise<EcommerceCategory[]> {
  return cachedFetch("categories", async () => {
    const res = await api<{ items: EcommerceCategory[] }>(`${BASE}/categories`);
    return res.items ?? [];
  });
}

export async function fetchProduct(skuId: string, warehouseId = DEFAULT_WAREHOUSE_ID): Promise<CatalogProduct> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  return api<CatalogProduct>(`${BASE}/catalog/${skuId}?${params}`);
}

export const catalogApi = { fetchCatalog, fetchCategories, fetchProduct };
