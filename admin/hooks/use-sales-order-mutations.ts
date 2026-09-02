"use client";

/**
 * @file use-sales-order-mutations.ts
 * @description Confirma pedido, registra pagamento, cancela.
 * @consumers pedidos/[id]/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-sales-order-mutations.ts
 * @description Confirma pedido, registra pagamento, cancela.
 * @consumers pedidos/[id]/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

type RecordOrderPaymentInput = {
  id: string;
  amount_usd: number;
  method: string;
  reference?: string;
};

export function useConfirmOrder() {
  const mutate = useCallback((id: string) => salesApi.confirmOrder(id), []);
  return useApiMutation(mutate);
}

export function useConfirmOrderCredit() {
  const mutate = useCallback((id: string) => salesApi.confirmCredit(id), []);
  return useApiMutation(mutate);
}

export function useRecordOrderPayment() {
  const mutate = useCallback(
    ({ id, amount_usd, method, reference }: RecordOrderPaymentInput) =>
      salesApi.recordPayment(id, { amount_usd, method, reference }),
    [],
  );
  return useApiMutation(mutate);
}

export function useCancelOrder() {
  const mutate = useCallback((id: string) => salesApi.cancelOrder(id), []);
  return useApiMutation(mutate);
}
