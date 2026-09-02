"use client";

/**
 * @file use-compras-paraguai-mutations.ts
 * @description Dispara sincronização manual do feed XML Compras Paraguai.
 * @consumers integracoes/compras-paraguai/page.tsx
 * @remarks Requer permissão pim.products.write.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-compras-paraguai-mutations.ts
 * @description Dispara sincronização manual do feed XML Compras Paraguai.
 * @consumers integracoes/compras-paraguai/page.tsx
 * @remarks Requer permissão pim.products.write.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { integrationsApi } from "@/lib/api/integrations";
import { useApiMutation } from "./use-api-mutation";

export function useRunComprasParaguaiSync() {
  const mutate = useCallback((_body: Record<string, never>) => integrationsApi.runSync(), []);
  return useApiMutation(mutate);
}
