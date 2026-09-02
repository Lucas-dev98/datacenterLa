"use client";

/**
 * @file use-supplier-return-mutations.ts
 * @description Atualiza status de devolução ao fornecedor.
 * @consumers estoque/entrada/devolucoes-fornecedor/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import { useApiMutation } from "./use-api-mutation";

type UpdateSupplierReturnStatusInput = {
  id: string;
  status: "sent" | "closed" | "cancelled";
};

export function useUpdateSupplierReturnStatus() {
  const mutate = useCallback(
    ({ id, status }: UpdateSupplierReturnStatusInput) =>
      stockApi.updateSupplierReturnStatus(id, status),
    [],
  );
  return useApiMutation(mutate);
}
