"use client";

import { useCallback, useEffect, useState } from "react";

type UseApiQueryOptions = {
  /** Skip fetch when false (default true). */
  enabled?: boolean;
  /** Refetch when these values change. */
  deps?: unknown[];
};

/** Fetch via a domain API module (salesApi, stockApi, etc.). */
export function useApiQueryFn<T>(
  fetcher: () => Promise<T>,
  options: UseApiQueryOptions & { key?: string } = {},
) {
  const { enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError("");
    try {
      const result = await fetcher();
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, ...deps]);

  return { data, error, loading, refetch, setData };
}
