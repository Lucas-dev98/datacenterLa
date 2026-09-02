"use client";

/**
 * @file use-api-query.ts
 * @description Primitivo de leitura: encapsula fetch assíncrono com loading, erro e refetch.
 * @consumers Todos os hooks use-*-list, use-*-dashboard, use-*-detail
 * @remarks data inicia como null — use `data ?? []` nas páginas.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
/**
 * @file use-api-query.ts
 * @description Primitivo de leitura: encapsula fetch assíncrono com loading, erro e refetch.
 * @consumers Todos os hooks use-*-list, use-*-dashboard, use-*-detail
 * @remarks data inicia como null — use `data ?? []` nas páginas.
 *
 * @see admin/hooks/README.md — catálogo completo
 * @see admin/docs/API_HOOKS.md — padrão query/mutation
 */
import { useCallback, useEffect, useState } from "react";

/** Opções do hook de leitura. */
type UseApiQueryOptions = {
  /** Quando `false`, não dispara fetch (ex.: detalhe sem id ainda). Padrão: `true`. */
  enabled?: boolean;
  /** Valores extras que disparam novo fetch além de `refetch` (filtros, paginação, id). */
  deps?: unknown[];
};

/**
 * Hook genérico para leituras via módulos `@/lib/api/*`.
 *
 * - Estado inicial: `data === null`, `loading === enabled`.
 * - Após mutation, chame `refetch()` em vez de `load()` manual.
 * - Em listagens use `const items = data ?? []`.
 *
 * @param fetcher Função que retorna a Promise da API (memoize com `useCallback`).
 * @param options `enabled` e `deps` controlam quando o fetch roda.
 */
export function useApiQueryFn<T>(
  fetcher: () => Promise<T>,
  options: UseApiQueryOptions & { key?: string } = {},
) {
  const { enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);

  /** Recarrega dados; retorna o resultado ou `null` em caso de erro. */
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
    // deps extras (filtros, id) além de refetch — intencional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, ...deps]);

  return { data, error, loading, refetch, setData };
}
