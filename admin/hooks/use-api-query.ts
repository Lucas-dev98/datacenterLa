"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type UseApiQueryOptions = {
  /** Skip fetch when false (default true). */
  enabled?: boolean;
  /** Refetch when these values change. */
  deps?: unknown[];
};

export function useApiQuery<T>(path: string | null, options: UseApiQueryOptions = {}) {
  const { enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path) && enabled);

  const refetch = useCallback(async () => {
    if (!path || !enabled) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(path);
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, ...deps]);

  return { data, error, loading, refetch, setData };
}
