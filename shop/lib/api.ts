import { API_URL, DEFAULT_WAREHOUSE_ID } from "./config";
import { getShopToken } from "./auth";
import { notifyCartChanged } from "./cart-events";
import { cachedFetch } from "./catalog-cache";
import type { ApiError, Cart, CatalogProduct, EcommerceCategory, Order, PublicOrder } from "./types";

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(status: number, body: ApiError) {
    super(formatApiError(body));
    this.code = body.code;
    this.status = status;
  }
}

function formatApiError(body: ApiError): string {
  switch (body.code) {
    case "EMPTY_CART":
      return "Seu carrinho está vazio. Volte ao catálogo e adicione produtos.";
    case "INSUFFICIENT_STOCK":
      return body.message.includes("insufficient stock") || body.message.includes("disponível")
        ? "Estoque insuficiente para concluir a compra. Reduza a quantidade ou escolha outro produto."
        : body.message;
    case "INVALID_INPUT":
      return "Dados inválidos. Verifique nome, e-mail e tente novamente.";
    case "NOT_FOUND":
      return "Pedido não encontrado. Confira o e-mail usado no checkout e o número completo (ex.: PED-000123).";
    case "UNAUTHORIZED":
      return "Faça login para ver seus pedidos.";
    case "INVALID_CODE":
      return "Código inválido ou expirado. Solicite um novo código.";
    case "TOO_MANY_REQUESTS":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "COOLDOWN":
      return "Aguarde alguns segundos antes de solicitar outro código.";
    default:
      return body.message || "Erro inesperado";
  }
}

async function parseError(res: Response): Promise<ApiClientError> {
  let body: ApiError = { code: "UNKNOWN", message: res.statusText };
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* ignore */
  }
  return new ApiClientError(res.status, body);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function authApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getShopToken();
  if (!token) {
    throw new ApiClientError(401, { code: "UNAUTHORIZED", message: "Faça login para continuar." });
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return api<T>(path, { ...init, headers });
}

export async function fetchCatalog(
  warehouseId = DEFAULT_WAREHOUSE_ID,
  opts?: { categoryId?: string; q?: string },
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  if (opts?.categoryId) params.set("category_id", opts.categoryId);
  if (opts?.q) params.set("q", opts.q);
  const cacheKey = `catalog:${params.toString()}`;
  return cachedFetch(cacheKey, async () => {
    const res = await api<{ items: CatalogProduct[] }>(`/api/v1/ecommerce/catalog?${params}`);
    return res.items ?? [];
  });
}

export async function fetchCategories(): Promise<EcommerceCategory[]> {
  return cachedFetch("categories", async () => {
    const res = await api<{ items: EcommerceCategory[] }>("/api/v1/ecommerce/categories");
    return res.items ?? [];
  });
}

export function normalizeOrderNumber(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return s;
  if (s.startsWith("PED-")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) return s;
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return s;
  return `PED-${String(n).padStart(6, "0")}`;
}

export async function requestShopLoginCode(email: string): Promise<{ message: string }> {
  return api("/api/v1/ecommerce/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export type ShopAuthTokens = {
  access_token: string;
  expires_in: number;
  email: string;
};

export async function verifyShopLoginCode(email: string, code: string): Promise<ShopAuthTokens> {
  return api("/api/v1/ecommerce/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  });
}

export async function listMyOrders(): Promise<PublicOrder[]> {
  const res = await authApi<{ items: PublicOrder[] }>("/api/v1/ecommerce/orders/me");
  return res.items ?? [];
}

export async function getMyOrder(orderNumber: string): Promise<PublicOrder> {
  const normalized = normalizeOrderNumber(orderNumber);
  return authApi<PublicOrder>(`/api/v1/ecommerce/orders/me/${encodeURIComponent(normalized)}`);
}

export async function fetchCart(sessionId: string): Promise<Cart> {
  return api<Cart>(`/api/v1/ecommerce/cart?session_id=${encodeURIComponent(sessionId)}`);
}

export async function addToCart(
  sessionId: string,
  skuId: string,
  quantity: number,
  warehouseId = DEFAULT_WAREHOUSE_ID,
): Promise<Cart> {
  const cart = await api<Cart>("/api/v1/ecommerce/cart/items", {
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
  const cart = await api<Cart>("/api/v1/ecommerce/cart/items", {
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
  return api<PaymentConfig>("/api/v1/ecommerce/payments/config");
}

export async function checkout(payload: CheckoutPayload): Promise<CheckoutResult> {
  return api<CheckoutResult>("/api/v1/ecommerce/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmPaymentIntent(intentId: string, sessionId?: string): Promise<{ status: string }> {
  return api(`/api/v1/ecommerce/payments/intents/${intentId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId ?? "" }),
  });
}

export async function fetchProduct(skuId: string, warehouseId = DEFAULT_WAREHOUSE_ID): Promise<CatalogProduct> {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  return api<CatalogProduct>(`/api/v1/ecommerce/catalog/${skuId}?${params}`);
}

export type QuotePayload = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
};

export async function submitQuote(payload: QuotePayload): Promise<void> {
  await api("/api/v1/ecommerce/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
