import type { Order } from "../types";
import { api } from "./client";

const BASE = "/api/v1/ecommerce";

export type CheckoutPayload = {
  session_id: string;
  warehouse_id: string;
  name: string;
  email?: string;
  phone?: string;
  document_id?: string;
};

export type PaymentConfig = {
  provider: string;
  stripe_publishable_key?: string;
};

export type PaymentIntent = {
  id: string;
  order_id: string;
  amount_usd: number;
  provider: string;
  status: string;
  client_secret: string;
};

export type CheckoutResult = {
  order: Order;
  payment_intent: PaymentIntent;
};

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  return api<PaymentConfig>(`${BASE}/payments/config`);
}

export async function checkout(payload: CheckoutPayload): Promise<CheckoutResult> {
  return api<CheckoutResult>(`${BASE}/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmPaymentIntent(intentId: string, sessionId?: string): Promise<{ status: string }> {
  return api(`${BASE}/payments/intents/${intentId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId ?? "" }),
  });
}

export const checkoutApi = { fetchPaymentConfig, checkout, confirmPaymentIntent };
