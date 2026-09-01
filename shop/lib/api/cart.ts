import { DEFAULT_WAREHOUSE_ID } from "../config";
import { notifyCartChanged } from "../cart-events";
import type { Cart } from "../types";
import { api } from "./client";

const BASE = "/api/v1/ecommerce/cart";

export async function fetchCart(sessionId: string): Promise<Cart> {
  return api<Cart>(`${BASE}?session_id=${encodeURIComponent(sessionId)}`);
}

export async function addToCart(
  sessionId: string,
  skuId: string,
  quantity: number,
  warehouseId = DEFAULT_WAREHOUSE_ID,
): Promise<Cart> {
  const cart = await api<Cart>(`${BASE}/items`, {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      sku_id: skuId,
      warehouse_id: warehouseId,
      quantity,
    }),
  });
  notifyCartChanged();
  return cart;
}

export async function updateCartItem(
  sessionId: string,
  skuId: string,
  quantity: number,
  warehouseId = DEFAULT_WAREHOUSE_ID,
): Promise<Cart> {
  const cart = await api<Cart>(`${BASE}/items`, {
    method: "PUT",
    body: JSON.stringify({
      session_id: sessionId,
      sku_id: skuId,
      warehouse_id: warehouseId,
      quantity,
    }),
  });
  notifyCartChanged();
  return cart;
}

export const cartApi = { fetchCart, addToCart, updateCartItem };
