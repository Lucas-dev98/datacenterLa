"use client";

import { useCallback } from "react";
import { rmaApi } from "@/lib/api/rma";
import { useApiMutation } from "./use-api-mutation";

export function useCreateRMA() {
  const mutate = useCallback((form: FormData) => rmaApi.createWithPhotos(form), []);
  return useApiMutation(mutate);
}
