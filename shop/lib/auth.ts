"use client";

const TOKEN_KEY = "dcla_shop_token";
const EMAIL_KEY = "dcla_shop_email";

export function getShopToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getShopEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function saveShopSession(token: string, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
}

export function clearShopSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function isShopAuthenticated(): boolean {
  return !!getShopToken();
}
