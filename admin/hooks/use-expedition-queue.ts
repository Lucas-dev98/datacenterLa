"use client";

/**
 * @file use-expedition-queue.ts
 * @description Pedidos prontos para expedição (fila operacional).
 * @consumers components/expedition-queue-panel.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import type { OrderListItem } from "@/lib/types";
import { useApiQueryFn } from "./use-api-query";

export function useExpeditionQueue() {
  const fetcher = useCallback(async (): Promise<OrderListItem[]> => salesApi.listExpeditionQueue(), []);
  return useApiQueryFn(fetcher, { deps: [] });
}
