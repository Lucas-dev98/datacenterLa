/**
 * @file returns.ts
 * @description /api/v1/sales/returns — devoluções comerciais.
 * @hooks hooks: use-customer-returns-*, use-return-step
 *
 * @see admin/lib/api/README.md
 */

import { api, apiBlob, apiForm } from "./client";
import type { Order, OrderItem, OrderListItem } from "../types";
import { salesApi } from "./sales";

const BASE = "/api/v1/sales/returns";

export type ReturnPhoto = {
  id: string;
  return_id: string;
  created_at: string;
};

export type CustomerReturn = {
  id: string;
  return_number: string;
  order_number?: string;
  customer_name?: string;
  status: string;
  reason: string;
  condition_notes?: string;
  within_return_window: boolean;
  return_window_days?: number;
  return_expires_at?: string;
  photos?: ReturnPhoto[];
  resolution?: string;
  created_at: string;
};

export type ReturnWindowCheck = {
  return_window_days: number;
  return_expires_at?: string;
  within_return_window: boolean;
};

export const returnsApi = {
  list: (q?: string) => {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return api<{ items: CustomerReturn[] }>(`${BASE}${qs}`);
  },
  get: (id: string) => api<CustomerReturn>(`${BASE}/${id}`),
  windowCheck: (orderId: string) =>
    api<ReturnWindowCheck>(`${BASE}/window-check?order_id=${encodeURIComponent(orderId)}`),
  eligibility: (orderId: string, orderItemId: string) =>
    api<{ eligible_units: number }>(
      `${BASE}/eligibility?order_id=${encodeURIComponent(orderId)}&order_item_id=${encodeURIComponent(orderItemId)}`,
    ),
  loadOrderContext: async (orderId: string) => {
    const [order, windowInfo] = await Promise.all([
      salesApi.getOrder(orderId),
      returnsApi.windowCheck(orderId),
    ]);
    return { order, orderItems: (order.items ?? []) as OrderItem[], windowInfo };
  },
  searchShippedOrders: (q: string) => salesApi.searchShippedOrders(q),
  createWithPhotos: (form: FormData) => apiForm(`${BASE}`, form),
  photoBlob: (returnId: string, photoId: string) =>
    apiBlob(`${BASE}/${returnId}/photos/${photoId}/file`),
  step: (id: string, step: string, body?: Record<string, unknown>) =>
    api(`${BASE}/${id}/${step}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export type { Order, OrderListItem };
