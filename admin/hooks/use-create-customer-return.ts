"use client";

import { useCallback } from "react";
import { returnsApi } from "@/lib/api/returns";
import { useApiMutation } from "./use-api-mutation";

export function useCreateCustomerReturn() {
  const mutate = useCallback((form: FormData) => returnsApi.createWithPhotos(form), []);
  return useApiMutation(mutate);
}
