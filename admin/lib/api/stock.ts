import { api } from "./client";
import type { InventoryUnit } from "../types";

const STOCK = "/api/v1/stock";
const PURCHASES = "/api/v1/purchases";

export type PurchaseOrderSummary = {
  id: string;
  po_number: string;
  status: string;
};

export type SupplierSummary = {
  id: string;
  code: string;
  name: string;
};

export const stockApi = {
  listUnits: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit ?? 100));
    return api<{ items: InventoryUnit[] }>(`${STOCK}/units?${q}`);
  },
};

export const purchasesApi = {
  listSuppliers: () => api<{ items: SupplierSummary[] }>(`${PURCHASES}/suppliers`),
  listOrders: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return api<{ items: PurchaseOrderSummary[] }>(`${PURCHASES}/orders${q}`);
  },
  getOrder: (id: string) => api<PurchaseOrderSummary>(`${PURCHASES}/orders/${id}`),
};
