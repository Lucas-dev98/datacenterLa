"use client";

/**
 * @file use-create-customer-return.ts
 * @description Registra devolução comercial com fotos (multipart).
 * @consumers devolucoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { returnsApi } from "@/lib/api/returns";
import { useApiMutation } from "./use-api-mutation";

export function useCreateCustomerReturn() {
  const mutate = useCallback((form: FormData) => returnsApi.createWithPhotos(form), []);
  return useApiMutation(mutate);
}
