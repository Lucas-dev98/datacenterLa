import { API_URL, DEFAULT_WAREHOUSE_ID } from "./config";
import type { CatalogProduct, EcommerceCategory } from "./types";
import type { PlatformDefaults, StorefrontPage } from "./storefront-types";

const REVALIDATE_SEC = 120;

async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: REVALIDATE_SEC } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCatalogServer(
  warehouseId = DEFAULT_WAREHOUSE_ID,
  opts?: { categoryId?: string; q?: string },
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  if (opts?.categoryId) params.set("category_id", opts.categoryId);
  if (opts?.q) params.set("q", opts.q);
  const data = await serverGet<{ items?: CatalogProduct[] }>(`/api/v1/ecommerce/catalog?${params}`);
  return data?.items ?? [];
}

export async function fetchCategoriesServer(): Promise<EcommerceCategory[]> {
  const data = await serverGet<{ items?: EcommerceCategory[] }>("/api/v1/ecommerce/categories");
  return data?.items ?? [];
}

export async function fetchCatalogByCodesServer(
  codes: string[],
  warehouseId = DEFAULT_WAREHOUSE_ID,
): Promise<CatalogProduct[]> {
  if (codes.length === 0) return [];
  const params = new URLSearchParams({
    warehouse_id: warehouseId,
    sku_codes: codes.join(","),
  });
  const data = await serverGet<{ items?: CatalogProduct[] }>(`/api/v1/ecommerce/catalog?${params}`);
  return data?.items ?? [];
}

export async function fetchProductServer(
  skuIdOrCode: string,
  warehouseId = DEFAULT_WAREHOUSE_ID,
): Promise<CatalogProduct | null> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  const data = await serverGet<CatalogProduct>(
    `/api/v1/ecommerce/catalog/${encodeURIComponent(skuIdOrCode)}?${params}`,
  );
  return data;
}

export async function fetchStorefrontServer(
  warehouseId = DEFAULT_WAREHOUSE_ID,
): Promise<StorefrontPage | null> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  return serverGet<StorefrontPage>(`/api/v1/ecommerce/storefront?${params}`);
}

export async function fetchPlatformDefaultsServer(): Promise<PlatformDefaults | null> {
  return serverGet<PlatformDefaults>("/api/v1/platform/defaults");
}
