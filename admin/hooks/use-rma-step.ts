"use client";

/**
 * @file use-rma-step.ts
 * @description Avança workflow RMA: approve → receive → resolve.
 * @consumers rma/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-rma-step.ts
 * @description Avança workflow RMA: approve → receive → resolve.
 * @consumers rma/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { rmaApi } from "@/lib/api/rma";
import { useApiMutation } from "./use-api-mutation";

type RmaStepInput = {
  id: string;
  step: "approve" | "receive" | "resolve";
  body?: Record<string, unknown>;
};

export function useRmaStep() {
  const mutate = useCallback(
    ({ id, step, body }: RmaStepInput) => rmaApi.step(id, step, body),
    [],
  );
  return useApiMutation(mutate);
}
