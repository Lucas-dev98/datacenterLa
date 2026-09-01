"use client";

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
