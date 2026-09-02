"use client";

/**
 * @file use-create-rma.ts
 * @description Abre caso RMA com fotos de evidência do teste.
 * @consumers rma/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { rmaApi } from "@/lib/api/rma";
import { useApiMutation } from "./use-api-mutation";

export function useCreateRMA() {
  const mutate = useCallback((form: FormData) => rmaApi.createWithPhotos(form), []);
  return useApiMutation(mutate);
}
