import type { PublicOrder } from "../types";
import { api, authApi, normalizeOrderNumber } from "./client";

const BASE = "/api/v1/ecommerce";

export type ShopAuthTokens = {
  access_token: string;
  expires_in: number;
  email: string;
};

export async function requestShopLoginCode(email: string): Promise<{ message: string }> {
  return api(`${BASE}/auth/request-code`, {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function verifyShopLoginCode(email: string, code: string): Promise<ShopAuthTokens> {
  return api(`${BASE}/auth/verify-code`, {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  });
}

export async function listMyOrders(): Promise<PublicOrder[]> {
  const res = await authApi<{ items: PublicOrder[] }>(`${BASE}/orders/me`);
  return res.items ?? [];
}

export async function getMyOrder(orderNumber: string): Promise<PublicOrder> {
  const normalized = normalizeOrderNumber(orderNumber);
  return authApi<PublicOrder>(`${BASE}/orders/me/${encodeURIComponent(normalized)}`);
}

export const shopAuthApi = {
  requestShopLoginCode,
  verifyShopLoginCode,
  listMyOrders,
  getMyOrder,
  normalizeOrderNumber,
};
