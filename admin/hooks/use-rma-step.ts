"use client";

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
