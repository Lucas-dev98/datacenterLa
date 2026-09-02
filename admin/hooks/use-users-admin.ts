"use client";

/**
 * @file use-users-admin.ts
 * @description Usuários internos e roles para gestão de acesso.
 * @consumers usuarios/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-users-admin.ts
 * @description Usuários internos e roles para gestão de acesso.
 * @consumers usuarios/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { authApi, type Role } from "@/lib/api/auth";
import type { User } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export type UsersAdminData = {
  users: User[];
  roles: Role[];
};

export function useUsersAdmin() {
  const fetcher = useCallback(async (): Promise<UsersAdminData> => {
    const [usersRes, rolesRes] = await Promise.all([authApi.listUsers(), authApi.listRoles()]);
    return {
      users: usersRes.items ?? [],
      roles: rolesRes.items ?? [],
    };
  }, []);
  return useApiQueryFn(fetcher);
}
