"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

type UpdateLeadStatusInput = {
  id: string;
  status: string;
};

export function useCreateLead() {
  const mutate = useCallback((body: Record<string, unknown>) => salesApi.createLead(body), []);
  return useApiMutation(mutate);
}

export function useUpdateLeadStatus() {
  const mutate = useCallback(
    ({ id, status }: UpdateLeadStatusInput) => salesApi.updateLeadStatus(id, status),
    [],
  );
  return useApiMutation(mutate);
}
