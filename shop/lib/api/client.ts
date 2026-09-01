import { API_URL } from "../config";
import { getShopToken } from "../auth";
import type { ApiError } from "../types";

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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function authApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getShopToken();
  if (!token) {
    throw new ApiClientError(401, { code: "UNAUTHORIZED", message: "Faça login para continuar." });
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return api<T>(path, { ...init, headers });
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
