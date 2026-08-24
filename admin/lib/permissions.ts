import type { User } from "./types";

export function hasPermission(user: User | null | undefined, code: string): boolean {
  return Boolean(user?.permissions?.includes(code));
}

export function hasAnyPermission(user: User | null | undefined, codes: string[]): boolean {
  if (!user?.permissions?.length) return false;
  return codes.some((c) => user.permissions.includes(c));
}
