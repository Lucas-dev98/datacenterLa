"use client";

import { useCallback } from "react";
import { rmaApi, type RMACase } from "@/lib/api/rma";
import { useApiQueryFn } from "./use-api-query";

export function useRmaCasesList(query = "") {
  const fetcher = useCallback(async (): Promise<RMACase[]> => {
    const res = await rmaApi.list(query.trim());
    return res.items ?? [];
  }, [query]);
  return useApiQueryFn(fetcher, { deps: [query] });
}
