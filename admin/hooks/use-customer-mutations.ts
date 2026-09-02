"use client";

/**
 * @file use-customer-mutations.ts
 * @description Cria cliente B2B/B2C no cadastro.
 * @consumers clientes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-customer-mutations.ts
 * @description Cria cliente B2B/B2C no cadastro.
 * @consumers clientes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

export function useCreateCustomer() {
  const mutate = useCallback((body: Record<string, unknown>) => salesApi.createCustomer(body), []);
  return useApiMutation(mutate);
}
