"use client";

/**
 * @file use-return-step.ts
 * @description Avança workflow de devolução: approve → receive → resolve.
 * @consumers devolucoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-return-step.ts
 * @description Avança workflow de devolução: approve → receive → resolve.
 * @consumers devolucoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { returnsApi } from "@/lib/api/returns";
import { useApiMutation } from "./use-api-mutation";

type ReturnStepInput = {
  id: string;
  step: "approve" | "receive" | "resolve";
  body?: Record<string, unknown>;
};

export function useReturnStep() {
  const mutate = useCallback(
    ({ id, step, body }: ReturnStepInput) => returnsApi.step(id, step, body),
    [],
  );
  return useApiMutation(mutate);
}
