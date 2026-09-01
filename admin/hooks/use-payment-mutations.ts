"use client";

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
