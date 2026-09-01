"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

export function useCreateCustomer() {
  const mutate = useCallback((body: Record<string, unknown>) => salesApi.createCustomer(body), []);
  return useApiMutation(mutate);
}
