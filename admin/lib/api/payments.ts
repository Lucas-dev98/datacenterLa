import { api } from "./client";
import type { PaymentIntent } from "../types";

const BASE = "/api/v1/payments";

export const paymentsApi = {
  getConfig: () => api<{ provider: string; stripe_publishable_key?: string }>(`${BASE}/config`),
  createIntent: (orderId: string) =>
    api<PaymentIntent>(`${BASE}/intents`, {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    }),
  confirmIntent: (intentId: string) =>
    api(`${BASE}/intents/${intentId}/confirm`, { method: "POST" }),
};
