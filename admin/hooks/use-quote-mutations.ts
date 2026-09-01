"use client";

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
