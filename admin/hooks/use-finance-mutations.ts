"use client";

import { useCallback } from "react";
import { financeApi } from "@/lib/api/finance";
import { useApiMutation } from "./use-api-mutation";

type PaymentBody = {
  id: string;
  amount_usd: number;
  method: string;
  reference?: string;
};

export function useRecordReceivablePayment() {
  const mutate = useCallback(
    ({ id, amount_usd, method, reference }: PaymentBody) =>
      financeApi.recordReceivablePayment(id, { amount_usd, method, reference }),
    [],
  );
  return useApiMutation(mutate);
}

export function usePayPayable() {
  const mutate = useCallback(
    ({ id, amount_usd, method, reference }: PaymentBody) =>
      financeApi.payPayable(id, { amount_usd, method, reference }),
    [],
  );
  return useApiMutation(mutate);
}
