"use client";

const TOKEN_KEY = "dcla_shop_token";
const EMAIL_KEY = "dcla_shop_email";
const SESSION_COOKIE = "dcla_shop_session";

function setSessionCookie(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=604800; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

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
  setSessionCookie(true);
}

export function clearShopSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  setSessionCookie(false);
}

export function isShopAuthenticated(): boolean {
  return !!getShopToken();
}

export function syncShopSessionCookie() {
  setSessionCookie(isShopAuthenticated());
}
