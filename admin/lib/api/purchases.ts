import { api, apiText, receivePOIntakeWithPhotos } from "../api";
import type { InventoryUnitReceive } from "../types";

const BASE = "/api/v1/purchases";

export type PurchaseOrderItem = {
  sku_id: string;
  sku_code?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_usd: number;
  unit_landed_cost_usd?: number;
};

export type PurchaseOrderSummary = {
  id: string;
  po_number: string;
  supplier_name?: string;
  status: string;
  created_at: string;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  warehouse_id: string;
  items?: PurchaseOrderItem[];
};

export const purchasesApi = {
  listSuppliers: () =>
    api<{ items: { id: string; code: string; name: string }[] }>(`${BASE}/suppliers`),
  listOrders: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return api<{ items: PurchaseOrderSummary[] }>(`${BASE}/orders${q}`);
  },
  listPendingReceiveOrders: async (): Promise<PurchaseOrderSummary[]> => {
    const [ordered, partial] = await Promise.all([
      purchasesApi.listOrders("ordered"),
      purchasesApi.listOrders("partial"),
    ]);
    const merged = [...(ordered.items ?? []), ...(partial.items ?? [])];
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return merged;
  },
  getOrder: (id: string) => api<PurchaseOrderDetail>(`${BASE}/orders/${id}`),
  receiveIntake: (poId: string, form: FormData) => receivePOIntakeWithPhotos(poId, form),
};
