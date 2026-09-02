"use client";

/**
 * @file use-api-mutation.ts
 * @description Primitivo de escrita: encapsula POST/PATCH/DELETE com loading e erro.
 * @consumers Todos os hooks use-*-mutations
 * @remarks run() relança o erro após setError; trate com try/catch na página.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback, useState } from "react";
import { api } from "@/lib/api/client";

/**
 * Hook genérico para escritas (POST/PATCH/DELETE).
 *
 * - `run(body)` executa a mutation e relança o erro (além de preencher `error`).
 * - Use `setError("")` antes de chamar `run` se quiser limpar erro anterior na página.
 * - Após sucesso, chame `refetch()` do hook de leitura relacionado.
 *
 * @param mutate Função que recebe o body tipado e chama a API.
 */
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

/**
 * Atalho para mutations REST com body JSON.
 *
 * @param path Caminho relativo à API (ex.: `/api/v1/sales/orders`).
 * @param method Verbo HTTP; padrão POST.
 */
export function useApiPost<TBody, TResult>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST") {
  return useApiMutation<TBody, TResult>(async (body) =>
    api<TResult>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
