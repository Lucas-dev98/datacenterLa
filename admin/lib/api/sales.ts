import { api } from "./client";
import type { Customer, Order, Quote } from "../types";

const BASE = "/api/v1/sales";

export const salesApi = {
  listOrders: (params?: { status?: string; channel?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.channel) q.set("channel", params.channel);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return api<{ items: Order[]; total?: number }>(`${BASE}/orders${qs ? `?${qs}` : ""}`);
  },
  getOrder: (id: string) => api<Order>(`${BASE}/orders/${id}`),
  confirmOrder: (id: string) => api<Order>(`${BASE}/orders/${id}/confirm`, { method: "POST" }),
  listQuotes: (limit = 100) => api<{ items: Quote[] }>(`${BASE}/quotes?limit=${limit}`),
  listCustomers: (activeOnly = true) =>
    api<{ items: Customer[] }>(`${BASE}/customers?active_only=${activeOnly}`),
  createCustomer: (body: Record<string, unknown>) =>
    api<Customer>(`${BASE}/customers`, { method: "POST", body: JSON.stringify(body) }),
};
