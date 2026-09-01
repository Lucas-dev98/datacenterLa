import { api } from "./client";
import type { User } from "../types";

const BASE = "/api/v1/auth";

export type Role = {
  id: string;
  code: string;
  name: string;
};

export const authApi = {
  listUsers: () => api<{ items: User[] }>(`${BASE}/users`),
  listRoles: () => api<{ items: Role[] }>(`${BASE}/roles`),
  createUser: (body: Record<string, unknown>) =>
    api(`${BASE}/users`, { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    api(`${BASE}/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  mfaSetup: () => api<{ secret: string; url: string }>(`${BASE}/mfa/setup`, { method: "POST" }),
  mfaEnable: (code: string) =>
    api(`${BASE}/mfa/enable`, { method: "POST", body: JSON.stringify({ code }) }),
};
