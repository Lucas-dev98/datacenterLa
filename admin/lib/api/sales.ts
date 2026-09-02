/**
 * @file sales.ts
 * @description /api/v1/sales — pedidos, cotações, clientes, leads, dashboard.
 * @hooks hooks: use-sales-*, use-quotes-*, use-leads-*
 *
 * @see admin/lib/api/README.md
 */

import { api, apiBlob, apiForm, apiText } from "./client";
import type {
  AnalyticsDashboard,
  Customer,
  DashboardData,
  Order,
  OrderListItem,
  Quote,
  QuoteListItem,
} from "../types";

const BASE = "/api/v1/sales";

export type WebsiteRequest = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
  status: string;
  notes?: string;
  created_at: string;
};

export type Lead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
  source: string;
  created_at: string;
};

export const salesApi = {
  dashboard: () => api<DashboardData>(`${BASE}/dashboard`),
  analyticsDashboard: (params: { from: string; to: string; metric: string; channel?: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to, metric: params.metric });
    if (params.channel) q.set("channel", params.channel);
    return api<AnalyticsDashboard>(`${BASE}/analytics/dashboard?${q}`);
  },
  listOrders: (params?: { status?: string; channel?: string; limit?: number; offset?: number; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.channel) q.set("channel", params.channel);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    if (params?.q) q.set("q", params.q);
    const qs = q.toString();
    return api<{ items: OrderListItem[]; total?: number }>(`${BASE}/orders${qs ? `?${qs}` : ""}`);
  },
  searchShippedOrders: (q: string, limit = 20) =>
    salesApi.listOrders({ status: "shipped", q, limit }),
  getOrder: (id: string) => api<Order>(`${BASE}/orders/${id}`),
  getOrderWithCustomer: async (id: string) => {
    const order = await salesApi.getOrder(id);
    const customer = await salesApi.getCustomer(order.customer_id);
    return { order, customer };
  },
  confirmOrder: (id: string) => api<Order>(`${BASE}/orders/${id}/confirm`, { method: "POST" }),
  confirmCredit: (id: string) => api<Order>(`${BASE}/orders/${id}/confirm-credit`, { method: "POST" }),
  cancelOrder: (id: string) => api<Order>(`${BASE}/orders/${id}/cancel`, { method: "POST" }),
  recordPayment: (
    id: string,
    body: { amount_usd: number; method: string; reference?: string },
  ) =>
    api<Order>(`${BASE}/orders/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  orderReceiptHtml: (id: string) => apiText(`${BASE}/orders/${id}/receipt`),
  listQuotes: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    q.set("limit", String(params?.limit ?? 100));
    const qs = q.toString();
    return api<{ items: QuoteListItem[]; total: number }>(`${BASE}/quotes?${qs}`);
  },
  listWebsiteRequests: () => api<{ items: WebsiteRequest[] }>(`${BASE}/quotes/website-requests`),
  updateWebsiteRequestStatus: (id: string, status: string) =>
    api(`${BASE}/quotes/website-requests/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  getQuote: (id: string) => api<Quote>(`${BASE}/quotes/${id}`),
  sendQuote: (id: string) => api<Quote>(`${BASE}/quotes/${id}/send`, { method: "POST" }),
  convertQuote: (id: string, body: Record<string, unknown>) =>
    api<Order>(`${BASE}/quotes/${id}/convert`, { method: "POST", body: JSON.stringify(body) }),
  createQuote: (body: Record<string, unknown>) =>
    api<{ id: string }>(`${BASE}/quotes`, { method: "POST", body: JSON.stringify(body) }),
  listLeads: () => api<{ items: Lead[] }>(`${BASE}/leads`),
  createLead: (body: Record<string, unknown>) =>
    api(`${BASE}/leads`, { method: "POST", body: JSON.stringify(body) }),
  updateLeadStatus: (id: string, status: string) =>
    api(`${BASE}/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  listExpeditionQueue: async () => {
    const statuses = ["confirmed", "paid", "picking"] as const;
    const batches = await Promise.all(
      statuses.map((status) => salesApi.listOrders({ status, limit: 100 })),
    );
    const merged = batches.flatMap((b) => b.items ?? []);
    const byId = new Map<string, OrderListItem>();
    for (const o of merged) byId.set(o.id, o);
    const list = [...byId.values()];
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return list;
  },
  shipWithPhotos: (orderId: string, form: FormData) =>
    apiForm<void>(`${BASE}/orders/${orderId}/ship`, form),
  shipPhotoBlob: (orderId: string, photoId: string) =>
    apiBlob(`${BASE}/orders/${orderId}/ship-photos/${photoId}/file`),
  listCustomers: (activeOnly = true) =>
    api<{ items: Customer[] }>(`${BASE}/customers?active_only=${activeOnly}`),
  getCustomer: (id: string) => api<Customer>(`${BASE}/customers/${id}`),
  createCustomer: (body: Record<string, unknown>) =>
    api<Customer>(`${BASE}/customers`, { method: "POST", body: JSON.stringify(body) }),
};
