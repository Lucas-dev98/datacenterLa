"use client";

/**
 * @file use-ship-order.ts
 * @description Expede pedido com fotos da embalagem.
 * @consumers components/ship-expedition-modal.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

type ShipOrderInput = {
  orderId: string;
  form: FormData;
};

export function useShipOrder() {
  const mutate = useCallback(
    ({ orderId, form }: ShipOrderInput) => salesApi.shipWithPhotos(orderId, form),
    [],
  );
  return useApiMutation(mutate);
}
