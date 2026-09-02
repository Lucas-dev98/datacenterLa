"use client";

/**
 * @file use-platform-defaults.ts
 * @description IDs operacionais (armazém, local, categoria padrão) via app_settings.
 * @consumers cadastros/page.tsx
 * @remarks Fonte: GET /api/v1/platform/defaults
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { api } from "@/lib/api/client";
import { useApiQueryFn } from "./use-api-query";

export type PlatformDefaults = {
  warehouse_id: string;
  location_id: string;
  category_id: string;
};

export function usePlatformDefaults() {
  const fetcher = useCallback(() => api<PlatformDefaults>("/api/v1/platform/defaults"), []);
  return useApiQueryFn(fetcher);
}
