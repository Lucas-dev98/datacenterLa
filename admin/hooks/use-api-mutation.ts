"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";

export function useApiMutation<TBody, TResult>(
  mutate: (body: TBody) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (body: TBody) => {
      setLoading(true);
      setError("");
      try {
        return await mutate(body);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro na operação";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutate],
  );

  return { run, loading, error, setError };
}

/** POST/PATCH/DELETE helper with typed path. */
export function useApiPost<TBody, TResult>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST") {
  return useApiMutation<TBody, TResult>(async (body) =>
    api<TResult>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
