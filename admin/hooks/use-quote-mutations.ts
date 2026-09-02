"use client";

/**
 * @file use-quote-mutations.ts
 * @description Cria, envia e converte cotações; atualiza solicitação do site.
 * @consumers cotacoes/nova/page.tsx, cotacoes/[id]/page.tsx, cotacoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-quote-mutations.ts
 * @description Cria, envia e converte cotações; atualiza solicitação do site.
 * @consumers cotacoes/nova/page.tsx, cotacoes/[id]/page.tsx, cotacoes/page.tsx
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiMutation } from "./use-api-mutation";

type UpdateWebsiteRequestStatusInput = {
  id: string;
  status: string;
};

type ConvertQuoteInput = {
  id: string;
  body: Record<string, unknown>;
};

export function useCreateQuote() {
  const mutate = useCallback((body: Record<string, unknown>) => salesApi.createQuote(body), []);
  return useApiMutation(mutate);
}

export function useSendQuote() {
  const mutate = useCallback((id: string) => salesApi.sendQuote(id), []);
  return useApiMutation(mutate);
}

export function useConvertQuote() {
  const mutate = useCallback(({ id, body }: ConvertQuoteInput) => salesApi.convertQuote(id, body), []);
  return useApiMutation(mutate);
}

export function useUpdateWebsiteRequestStatus() {
  const mutate = useCallback(
    ({ id, status }: UpdateWebsiteRequestStatusInput) => salesApi.updateWebsiteRequestStatus(id, status),
    [],
  );
  return useApiMutation(mutate);
}
