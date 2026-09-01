import { api } from "./client";
import { uploadSKUImage } from "../api";
import type { CadastroResult, Category, CategoryAttribute, Product, SKU } from "../types";

const BASE = "/api/v1/pim";

export type { Category, CategoryAttribute, CadastroResult };

export const pimApi = {
  listProducts: (params?: { active_only?: boolean; limit?: number; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.active_only !== false) q.set("active_only", "true");
    q.set("limit", String(params?.limit ?? 100));
    if (params?.q?.trim()) q.set("q", params.q.trim());
    return api<{ items: Product[]; total?: number }>(`${BASE}/products?${q}`);
  },
  getProduct: (id: string) => api<Product & { skus?: SKU[] }>(`${BASE}/products/${id}`),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    api<Product>(`${BASE}/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProduct: (id: string) => api(`${BASE}/products/${id}`, { method: "DELETE" }),
  listSkus: (productId: string) => api<{ items: SKU[] }>(`${BASE}/products/${productId}/skus`),
  listAllSkus: (params?: { active_only?: boolean; limit?: number; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.active_only !== false) q.set("active_only", "true");
    q.set("limit", String(params?.limit ?? 100));
    if (params?.q?.trim()) q.set("q", params.q.trim());
    return api<{ items: SKU[]; total?: number }>(`${BASE}/skus?${q}`);
  },
  getSku: (id: string) => api<SKU>(`${BASE}/skus/${id}`),
  getSkuByCode: (code: string) => api<SKU>(`${BASE}/skus/code/${encodeURIComponent(code)}`),
  updateSku: (id: string, body: Record<string, unknown>) =>
    api<SKU>(`${BASE}/skus/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSku: (id: string) => api(`${BASE}/skus/${id}`, { method: "DELETE" }),
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
  listCategories: (activeOnly?: boolean) => {
    const qs = activeOnly ? "?active_only=true" : "";
    return api<{ items: Category[] }>(`${BASE}/categories${qs}`);
  },
  createCategory: (body: Record<string, unknown>) =>
    api<Category>(`${BASE}/categories`, { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    api<Category>(`${BASE}/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCategory: (id: string) => api(`${BASE}/categories/${id}`, { method: "DELETE" }),
  listCategoryAttributes: (categoryId: string) =>
    api<{ items: CategoryAttribute[] }>(`${BASE}/categories/${categoryId}/attributes`),
  createCategoryAttribute: (categoryId: string, body: Record<string, unknown>) =>
    api(`${BASE}/categories/${categoryId}/attributes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bulkCadastro: (body: Record<string, unknown>) =>
    api<CadastroResult>(`${BASE}/cadastros`, { method: "POST", body: JSON.stringify(body) }),
  uploadSkuImage: (skuId: string, file: File) => uploadSKUImage(skuId, file),
};
