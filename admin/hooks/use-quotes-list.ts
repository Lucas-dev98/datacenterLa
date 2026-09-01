"use client";

import { useCallback } from "react";
import { salesApi } from "@/lib/api/sales";
import { useApiQueryFn } from "./use-api-query";

export function useQuotesList(status = "") {
  const fetcher = useCallback(async () => {
    const res = await salesApi.listQuotes({ status: status || undefined, limit: 50 });
    return { items: res.items, total: res.total };
  }, [status]);
  return useApiQueryFn(fetcher, { deps: [status] });
}

export function useWebsiteRequestsList() {
  const fetcher = useCallback(async () => {
    const res = await salesApi.listWebsiteRequests();
    return res.items ?? [];
  }, []);
  return useApiQueryFn(fetcher);
}

export function useQuoteDetail(quoteId: string) {
  const fetcher = useCallback(() => salesApi.getQuote(quoteId), [quoteId]);
  return useApiQueryFn(fetcher, { deps: [quoteId], enabled: Boolean(quoteId) });
}
