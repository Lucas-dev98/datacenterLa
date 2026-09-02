"use client";

/**
 * @file use-supplier-returns-list.ts
 * @description Lista devoluções enviadas a fornecedores.
 * @consumers estoque/entrada/devolucoes-fornecedor/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi, type SupplierReturn } from "@/lib/api/stock";
import { useApiQueryFn } from "./use-api-query";

export function useSupplierReturnsList(statusFilter = "") {
  const fetcher = useCallback(async (): Promise<SupplierReturn[]> => {
    const res = await stockApi.listSupplierReturns(statusFilter || undefined);
    return res.items ?? [];
  }, [statusFilter]);
  return useApiQueryFn(fetcher, { deps: [statusFilter] });
}
