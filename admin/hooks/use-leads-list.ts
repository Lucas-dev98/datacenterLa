"use client";

/**
 * @file use-leads-list.ts
 * @description Lista todos os leads do CRM.
 * @consumers crm/leads/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

export function useLeadsList() {
  const fetcher = useCallback(async () => {
    const res = await salesApi.listLeads();
    return res.items ?? [];
  }, []);
  return useApiQueryFn(fetcher);
}
