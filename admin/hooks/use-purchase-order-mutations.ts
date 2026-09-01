"use client";

import { useCallback } from "react";
import { purchasesApi } from "@/lib/api/purchases";
import { useApiMutation } from "./use-api-mutation";

type SaveSupplierInput = {
  editingId: string | null;
  body: Record<string, unknown>;
};

export function useSaveSupplier() {
  const mutate = useCallback(async ({ editingId, body }: SaveSupplierInput) => {
    if (editingId) {
      return purchasesApi.updateSupplier(editingId, body);
    }
    return purchasesApi.createSupplier(body);
  }, []);
  return useApiMutation(mutate);
}

export function useCreateAndSubmitPurchaseOrder() {
  const mutate = useCallback(async (body: Record<string, unknown>) => {
    const po = await purchasesApi.createOrder(body);
    await purchasesApi.submitOrder(po.id);
    return po;
  }, []);
  return useApiMutation(mutate);
}
