"use client";

import { useCallback } from "react";
import { integrationsApi } from "@/lib/api/integrations";
import { useApiMutation } from "./use-api-mutation";

export function useRunComprasParaguaiSync() {
  const mutate = useCallback((_body: Record<string, never>) => integrationsApi.runSync(), []);
  return useApiMutation(mutate);
}
