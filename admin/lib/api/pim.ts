import { api } from "./client";
import type { Product, SKU } from "../types";

const BASE = "/api/v1/pim";

export const pimApi = {
  listProducts: (limit = 100) => api<{ items: Product[] }>(`${BASE}/products?limit=${limit}`),
  getProduct: (id: string) => api<Product>(`${BASE}/products/${id}`),
  listSkus: (productId: string) => api<{ items: SKU[] }>(`${BASE}/products/${productId}/skus`),
};
