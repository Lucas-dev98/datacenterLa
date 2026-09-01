import { api, apiText } from "../api";
import type { Customer, DashboardData, Order, OrderListItem, Quote } from "../types";

const BASE = "/api/v1/sales";

export const salesApi = {
  dashboard: () => api<DashboardData>(`${BASE}/dashboard`),
  listOrders: (params?: { status?: string; channel?: string; limit?: number; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.channel) q.set("channel", params.channel);
    if (params?.limit) q.set("limit", String(params.limit));
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
  listQuotes: (limit = 100) => api<{ items: Quote[] }>(`${BASE}/quotes?limit=${limit}`),
  listCustomers: (activeOnly = true) =>
    api<{ items: Customer[] }>(`${BASE}/customers?active_only=${activeOnly}`),
  getCustomer: (id: string) => api<Customer>(`${BASE}/customers/${id}`),
  createCustomer: (body: Record<string, unknown>) =>
    api<Customer>(`${BASE}/customers`, { method: "POST", body: JSON.stringify(body) }),
};
