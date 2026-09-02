"use client";

/**
 * @file use-lead-mutations.ts
 * @description Cria lead e atualiza status no funil CRM.
 * @consumers crm/leads/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-lead-mutations.ts
 * @description Cria lead e atualiza status no funil CRM.
 * @consumers crm/leads/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

type UpdateLeadStatusInput = {
  id: string;
  status: string;
};

export function useCreateLead() {
  const mutate = useCallback((body: Record<string, unknown>) => salesApi.createLead(body), []);
  return useApiMutation(mutate);
}

export function useUpdateLeadStatus() {
  const mutate = useCallback(
    ({ id, status }: UpdateLeadStatusInput) => salesApi.updateLeadStatus(id, status),
    [],
  );
  return useApiMutation(mutate);
}
