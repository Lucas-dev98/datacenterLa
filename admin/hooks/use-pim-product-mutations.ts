"use client";

import { useCallback } from "react";
import { pimApi } from "@/lib/api/pim";
import { useApiMutation } from "./use-api-mutation";

type UpdateProductInput = {
  id: string;
  body: Record<string, unknown>;
};

type UpdateSkuInput = {
  id: string;
  body: Record<string, unknown>;
};

type UploadSkuImageInput = {
  skuId: string;
  file: File;
};

type DeleteSkuProductInput = {
  skuId: string;
  productId?: string;
};

export function useUpdateProduct() {
  const mutate = useCallback(({ id, body }: UpdateProductInput) => pimApi.updateProduct(id, body), []);
  return useApiMutation(mutate);
}

export function useUpdateSku() {
  const mutate = useCallback(({ id, body }: UpdateSkuInput) => pimApi.updateSku(id, body), []);
  return useApiMutation(mutate);
}

export function useUploadSkuImage() {
  const mutate = useCallback(({ skuId, file }: UploadSkuImageInput) => pimApi.uploadSkuImage(skuId, file), []);
  return useApiMutation(mutate);
}

export function useBulkCadastro() {
  const mutate = useCallback((body: Record<string, unknown>) => pimApi.bulkCadastro(body), []);
  return useApiMutation(mutate);
}

export function useDeleteSkuProduct() {
  const mutate = useCallback(async ({ skuId, productId }: DeleteSkuProductInput) => {
    await pimApi.deleteSku(skuId);
    if (productId) {
      await pimApi.deleteProduct(productId).catch(() => undefined);
    }
  }, []);
  return useApiMutation(mutate);
}
