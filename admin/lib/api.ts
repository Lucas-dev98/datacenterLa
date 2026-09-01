import { API_URL } from "./config";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "./auth";
import type { ApiError, TokenPair } from "./types";

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.code = body.code;
    this.status = status;
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

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const tokens = (await res.json()) as TokenPair;
  saveTokens(tokens);
  return true;
}

async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("Content-Type") && init.body && !isForm && !(init.body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return authFetch(path, init, false);
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiClientError(401, { code: "UNAUTHORIZED", message: "Sessão expirada" });
  }

  return res;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await authFetch(path, init, retry);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiText(path: string, init: RequestInit = {}): Promise<string> {
  const res = await authFetch(path, init);
  if (!res.ok) throw await parseError(res);
  return res.text();
}

/** POST/PUT with multipart FormData; parses JSON body when present. */
export async function apiForm<T = unknown>(
  path: string,
  form: FormData,
  init: Omit<RequestInit, "body"> = {},
): Promise<T> {
  const res = await authFetch(path, {
    ...init,
    method: init.method ?? "POST",
    body: form,
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function blobObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function printHTML(html: string): boolean {
  if (typeof window === "undefined" || !html.trim()) return false;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank");

  if (!popup) {
    URL.revokeObjectURL(url);
    return false;
  }

  const revoke = () => URL.revokeObjectURL(url);
  popup.addEventListener("load", revoke, { once: true });
  window.setTimeout(revoke, 60_000);
  return true;
}

export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const res = await authFetch(path, init);
  if (!res.ok) throw await parseError(res);
  return res.blob();
}

export async function login(email: string, password: string, mfaCode?: string): Promise<TokenPair> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, mfa_code: mfaCode ?? "" }),
  });
  if (!res.ok) {
    let body: ApiError & { mfa_required?: boolean } = { code: "UNKNOWN", message: res.statusText };
    try {
      body = (await res.json()) as typeof body;
    } catch { /* ignore */ }
    const err = new ApiClientError(res.status, body);
    if (body.mfa_required) err.code = "MFA_REQUIRED";
    throw err;
  }
  return (await res.json()) as TokenPair;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
