"use client";

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
