"use client";

/**
 * @file use-stock-count-mutations.ts
 * @description Contagem cíclica e ajustes de inventário (criar → aprovar → aplicar).
 * @consumers estoque/inventario/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { stockApi } from "@/lib/api/stock";
import { useApiMutation } from "./use-api-mutation";

type CreateCountBody = {
  warehouse_id: string;
  count_type: string;
};

type AddCountLineInput = {
  countId: string;
  body: { unit_code?: string; sku_id?: string; counted_qty?: number };
};

type CreateAdjustmentBody = {
  warehouse_id: string;
  sku_id: string;
  quantity_delta: number;
  reason: string;
};

export function useCreateStockCount() {
  const mutate = useCallback((body: CreateCountBody) => stockApi.createCount(body), []);
  return useApiMutation(mutate);
}

export function useStartStockCount() {
  const mutate = useCallback((id: string) => stockApi.startCount(id), []);
  return useApiMutation(mutate);
}

export function useAddStockCountLine() {
  const mutate = useCallback(
    ({ countId, body }: AddCountLineInput) => stockApi.addCountLine(countId, body),
    [],
  );
  return useApiMutation(mutate);
}

export function useCompleteStockCount() {
  const mutate = useCallback((id: string) => stockApi.completeCount(id), []);
  return useApiMutation(mutate);
}

export function useApproveStockCount() {
  const mutate = useCallback((id: string) => stockApi.approveCount(id), []);
  return useApiMutation(mutate);
}

export function useCreateStockAdjustment() {
  const mutate = useCallback((body: CreateAdjustmentBody) => stockApi.createAdjustment(body), []);
  return useApiMutation(mutate);
}

export function useApproveStockAdjustment() {
  const mutate = useCallback((id: string) => stockApi.approveAdjustment(id), []);
  return useApiMutation(mutate);
}

export function useApplyStockAdjustment() {
  const mutate = useCallback((id: string) => stockApi.applyAdjustment(id), []);
  return useApiMutation(mutate);
}
