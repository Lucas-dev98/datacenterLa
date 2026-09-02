"use client";

/**
 * @file use-label-mutations.ts
 * @description Gera lote de etiquetas de gaveta (PDF ou HTML).
 * @consumers etiquetas/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-label-mutations.ts
 * @description Gera lote de etiquetas de gaveta (PDF ou HTML).
 * @consumers etiquetas/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { labelsApi } from "@/lib/api/labels";
import { useApiMutation } from "./use-api-mutation";

export type LabelBatchInput = {
  format: "pdf" | "html";
  items: { type: string; code: string }[];
};

export function useLabelBatchExport() {
  const mutate = useCallback((body: LabelBatchInput) => labelsApi.batch(body), []);
  return useApiMutation(mutate);
}
