import { api } from "./client";
import type { Product, SKU } from "../types";

const BASE = "/api/v1/pim";

export const pimApi = {
  listProducts: (limit = 100) => api<{ items: Product[] }>(`${BASE}/products?limit=${limit}`),
  getProduct: (id: string) => api<Product>(`${BASE}/products/${id}`),
  listSkus: (productId: string) => api<{ items: SKU[] }>(`${BASE}/products/${productId}/skus`),
  getSku: (id: string) => api<SKU>(`${BASE}/skus/${id}`),
  getSkuByCode: (code: string) => api<SKU>(`${BASE}/skus/code/${encodeURIComponent(code)}`),
  searchSkus: (q: string, limit = 25) =>
    api<{ items: SKU[] }>(`${BASE}/skus?q=${encodeURIComponent(q)}&active_only=true&limit=${limit}`),
  loadSkusByIds: async (ids: string[]): Promise<Record<string, SKU>> => {
    const unique = [...new Set(ids)];
    const entries = await Promise.all(
      unique.map(async (id) => {
        try {
          return [id, await pimApi.getSku(id)] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    );
    const map: Record<string, SKU> = {};
    for (const [id, sku] of entries) {
      if (sku) map[id] = sku;
    }
    return map;
  },
};
