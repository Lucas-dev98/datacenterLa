"use client";

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
