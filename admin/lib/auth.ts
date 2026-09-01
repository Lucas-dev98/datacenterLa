"use client";

import type { TokenPair, User } from "./types";

const ACCESS_KEY = "dcla_access_token";
const REFRESH_KEY = "dcla_refresh_token";
const SESSION_COOKIE = "dcla_session";

function setSessionCookie(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=604800; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function saveTokens(tokens: TokenPair) {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  setSessionCookie(true);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("dcla_user");
  setSessionCookie(false);
}

/** Keeps middleware cookie in sync for sessions created before middleware existed. */
export function syncSessionCookie() {
  setSessionCookie(isAuthenticated());
}

export function saveUser(user: User) {
  localStorage.setItem("dcla_user", JSON.stringify(user));
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("dcla_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
