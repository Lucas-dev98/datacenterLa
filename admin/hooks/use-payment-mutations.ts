"use client";

/**
 * @file use-payment-mutations.ts
 * @description Cria e confirma PaymentIntent Stripe no admin.
 * @consumers pedidos/[id]/page.tsx
 * @remarks UI do cartão fica em stripe-payment-form.tsx (SDK).
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { paymentsApi } from "@/lib/api/payments";
import { useApiMutation } from "./use-api-mutation";

export function useCreatePaymentIntent() {
  const mutate = useCallback((orderId: string) => paymentsApi.createIntent(orderId), []);
  return useApiMutation(mutate);
}

export function useConfirmPaymentIntent() {
  const mutate = useCallback((intentId: string) => paymentsApi.confirmIntent(intentId), []);
  return useApiMutation(mutate);
}
