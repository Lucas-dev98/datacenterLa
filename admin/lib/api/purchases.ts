import { api, apiForm, apiText } from "./client";
import type { InventoryUnitReceive } from "../types";

const BASE = "/api/v1/purchases";

export type Supplier = {
  id: string;
  code: string;
  name: string;
  legal_name?: string;
  country: string;
  kind: string;
  notes?: string;
};

export type PurchaseOrderItem = {
  id?: string;
  sku_id: string;
  sku_code?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_usd: number;
  unit_landed_cost_usd?: number;
};

export type PurchaseOrderPayable = {
  id: string;
  status: string;
  amount_usd: number;
  amount_paid_usd: number;
};

export type PurchaseOrderSummary = {
  id: string;
  po_number: string;
  supplier_name?: string;
  import_origin?: string;
  status: string;
  created_at: string;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  warehouse_id?: string;
  origin_country_code?: string;
  intercompany_invoice_ref?: string;
  customs_declaration_ref?: string;
  incoterms?: string;
  freight_usd?: number;
  duties_usd?: number;
  landed_cost_usd?: number;
  payable?: PurchaseOrderPayable | null;
  items?: PurchaseOrderItem[];
};

export const purchasesApi = {
  listSuppliers: () => api<{ items: Supplier[] }>(`${BASE}/suppliers`),
  createSupplier: (body: Record<string, unknown>) =>
    api<Supplier>(`${BASE}/suppliers`, { method: "POST", body: JSON.stringify(body) }),
  updateSupplier: (id: string, body: Record<string, unknown>) =>
    api<Supplier>(`${BASE}/suppliers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
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
  createOrder: (body: Record<string, unknown>) =>
    api<{ id: string }>(`${BASE}/orders`, { method: "POST", body: JSON.stringify(body) }),
  submitOrder: (id: string) => api(`${BASE}/orders/${id}/submit`, { method: "POST" }),
  receiveIntake: (poId: string, form: FormData) =>
    apiForm<{ order: unknown; units: InventoryUnitReceive[] }>(
      `${BASE}/orders/${poId}/receive-intake`,
      form,
    ),
};

export type { InventoryUnitReceive };
