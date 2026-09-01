"use client";

import { useCallback } from "react";
import { authApi } from "@/lib/api/auth";
import { useApiMutation } from "./use-api-mutation";

type UpdateUserInput = {
  id: string;
  body: Record<string, unknown>;
};

export function useCreateUser() {
  const mutate = useCallback((body: Record<string, unknown>) => authApi.createUser(body), []);
  return useApiMutation(mutate);
}

export function useUpdateUser() {
  const mutate = useCallback(({ id, body }: UpdateUserInput) => authApi.updateUser(id, body), []);
  return useApiMutation(mutate);
}
