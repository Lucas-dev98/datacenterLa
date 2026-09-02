"use client";

/**
 * @file use-purchase-receive-intake.ts
 * @description Confirma recebimento de compra com fotos de intake.
 * @consumers estoque/entrada/compras/[id]/receber/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { purchasesApi } from "@/lib/api/purchases";
import { useApiMutation } from "./use-api-mutation";

type ReceiveIntakeInput = {
  poId: string;
  form: FormData;
};

export function usePurchaseReceiveIntake() {
  const mutate = useCallback(
    ({ poId, form }: ReceiveIntakeInput) => purchasesApi.receiveIntake(poId, form),
    [],
  );
  return useApiMutation(mutate);
}
