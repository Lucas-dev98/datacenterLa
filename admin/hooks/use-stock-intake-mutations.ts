"use client";

import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import { useApiMutation } from "./use-api-mutation";

type IntakeAdvanceBody = {
  unit_id: string;
  location_id?: string;
};

type IntakeCompleteBody = {
  unit_ids: string[];
  location_id?: string;
};

type IntakeTestInput = {
  unitId: string;
  form: FormData;
};

export function useIntakeAdvance() {
  const mutate = useCallback((body: IntakeAdvanceBody) => stockApi.intakeAdvance(body), []);
  return useApiMutation(mutate);
}

export function useIntakeComplete() {
  const mutate = useCallback((body: IntakeCompleteBody) => stockApi.intakeComplete(body), []);
  return useApiMutation(mutate);
}

export function useUnitByCode() {
  const mutate = useCallback((code: string) => stockApi.unitByCode(code), []);
  return useApiMutation(mutate);
}

export function useIntakeTestPass() {
  const mutate = useCallback(
    ({ unitId, form }: IntakeTestInput) => stockApi.passIntakeTest(unitId, form),
    [],
  );
  return useApiMutation(mutate);
}

export function useIntakeTestFail() {
  const mutate = useCallback(
    ({ unitId, form }: IntakeTestInput) => stockApi.failIntakeTest(unitId, form),
    [],
  );
  return useApiMutation(mutate);
}
