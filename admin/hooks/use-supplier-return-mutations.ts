"use client";

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
