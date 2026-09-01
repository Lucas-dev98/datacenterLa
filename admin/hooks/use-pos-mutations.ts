"use client";

import { useCallback } from "react";
import { posApi } from "@/lib/api/pos";
import { useApiMutation } from "./use-api-mutation";

export type PosPixInitBody = {
  customer_id?: string;
  buyer_profile: string;
  warehouse_id: string;
  items: { sku_id: string; quantity: number }[];
  discount_pct: number;
};

export type PosPixConfirmBody = {
  orderId: string;
  reference?: string;
  ship_immediately?: boolean;
};

export function usePosPixInit() {
  const mutate = useCallback((body: PosPixInitBody) => posApi.pixInit(body), []);
  return useApiMutation(mutate);
}

export function usePosPixConfirm() {
  const mutate = useCallback(
    (body: PosPixConfirmBody) =>
      posApi.pixConfirm(body.orderId, {
        reference: body.reference,
        ship_immediately: body.ship_immediately,
      }),
    [],
  );
  return useApiMutation(mutate);
}

export function usePosPixCancel() {
  const mutate = useCallback((orderId: string) => posApi.pixCancel(orderId), []);
  return useApiMutation(mutate);
}
