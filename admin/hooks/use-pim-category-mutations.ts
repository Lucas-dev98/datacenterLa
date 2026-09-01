"use client";

import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import { useApiMutation } from "./use-api-mutation";

type UpdateCategoryInput = {
  id: string;
  body: Record<string, unknown>;
};

type CreateCategoryAttributeInput = {
  categoryId: string;
  body: Record<string, unknown>;
};

export function useCreateCategory() {
  const mutate = useCallback((body: Record<string, unknown>) => pimApi.createCategory(body), []);
  return useApiMutation(mutate);
}

export function useUpdateCategory() {
  const mutate = useCallback(({ id, body }: UpdateCategoryInput) => pimApi.updateCategory(id, body), []);
  return useApiMutation(mutate);
}

export function useDeleteCategory() {
  const mutate = useCallback((id: string) => pimApi.deleteCategory(id), []);
  return useApiMutation(mutate);
}

export function useCreateCategoryAttribute() {
  const mutate = useCallback(
    ({ categoryId, body }: CreateCategoryAttributeInput) =>
      pimApi.createCategoryAttribute(categoryId, body),
    [],
  );
  return useApiMutation(mutate);
}
