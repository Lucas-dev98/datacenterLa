/**
 * @file rma.ts
 * @description /api/v1/sales/rma — garantia técnica.
 * @hooks hooks: use-rma-*
 *
 * @see admin/lib/api/README.md
 */

import { api, apiBlob, apiForm } from "./client";
import type { Order, OrderItem, OrderListItem } from "../types";
import { salesApi } from "./sales";

const BASE = "/api/v1/sales/rma";

export type RMATestPhoto = {
  id: string;
  rma_case_id: string;
  created_at: string;
};

export type RMACase = {
  id: string;
  case_number: string;
  order_number?: string;
  customer_name?: string;
  status: string;
  reason: string;
  test_notes?: string;
  defect_confirmed: boolean;
  within_warranty: boolean;
  warranty_days?: number;
  warranty_expires_at?: string;
  test_photos?: RMATestPhoto[];
  resolution?: string;
  created_at: string;
};

export type WarrantyCheck = {
  warranty_days: number;
  warranty_expires_at?: string;
  within_warranty: boolean;
};

export const rmaApi = {
  list: (q?: string) => {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return api<{ items: RMACase[] }>(`${BASE}${qs}`);
  },
  get: (id: string) => api<RMACase>(`${BASE}/${id}`),
  warrantyCheck: (orderId: string) =>
    api<WarrantyCheck>(`${BASE}/warranty-check?order_id=${encodeURIComponent(orderId)}`),
  eligibility: (orderId: string, orderItemId: string) =>
    api<{ eligible_units: number }>(
      `${BASE}/eligibility?order_id=${encodeURIComponent(orderId)}&order_item_id=${encodeURIComponent(orderItemId)}`,
    ),
  loadOrderContext: async (orderId: string) => {
    const [order, warranty] = await Promise.all([
      salesApi.getOrder(orderId),
      rmaApi.warrantyCheck(orderId),
    ]);
    return { order, orderItems: (order.items ?? []) as OrderItem[], warranty };
  },
  searchShippedOrders: (q: string) => salesApi.searchShippedOrders(q),
  createWithPhotos: (form: FormData) => apiForm(`${BASE}`, form),
  testPhotoBlob: (caseId: string, photoId: string) =>
    apiBlob(`${BASE}/${caseId}/test-photos/${photoId}/file`),
  step: (id: string, step: string, body?: Record<string, unknown>) =>
    api(`${BASE}/${id}/${step}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export type { Order, OrderListItem };
