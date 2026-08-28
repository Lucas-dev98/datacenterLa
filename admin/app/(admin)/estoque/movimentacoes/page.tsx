"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import {
  MOVEMENT_TYPE_OPTIONS,
  movementReferenceHref,
  movementReferenceLabel,
  movementTypeBadgeClass,
  movementTypeLabel,
  unitStatusLabel,
} from "@/lib/stock-movements";
import type { StockMovementRow } from "@/lib/types";
import { Alert, Button, Card, Input, Select, Table } from "@/components/ui";

const PAGE_SIZE = 50;

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function EstoqueMovimentacoesPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [movementType, setMovementType] = useState("");
  const [items, setItems] = useState<StockMovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (q: string, type: string, pageOffset: number, append: boolean) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          warehouse_id: DEFAULT_WAREHOUSE_ID,
          limit: String(PAGE_SIZE),
          offset: String(pageOffset),
        });
        if (q.trim()) params.set("q", q.trim());
        if (type) params.set("movement_type", type);
        const res = await api<{ items: StockMovementRow[]; total: number }>(
          `/api/v1/stock/movements?${params}`,
        );
        const next = res.items ?? [];
        setItems((prev) => (append ? [...prev, ...next] : next));
        setTotal(res.total ?? 0);
        setOffset(pageOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar movimentações");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setQuery(q);
    void load(q, "", 0, false);
  }, [load, searchParams]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(query, movementType, 0, false);
  }

  function onLoadMore() {
    void load(query, movementType, offset + PAGE_SIZE, true);
  }

  const hasMore = items.length < total;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/estoque" className="hover:underline">
            Estoque
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Movimentações</h1>
        <p className="mt-1 text-sm text-slate-600">
          Histórico auditável de entradas, saídas, reservas e mudanças de status por unidade (AAA).
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={onSearch}>
          <div className="min-w-[200px] flex-1">
            <Input
              className="font-mono"
              placeholder="SKU, nome ou código AAA…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <Select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
              <option value="">Todos os tipos</option>
              {MOVEMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={loading}>
            Buscar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => void load(query, movementType, 0, false)}
          >
            Atualizar
          </Button>
        </form>

        <p className="mb-3 text-sm text-slate-500">
          {total === 0 && !loading
            ? "Nenhuma movimentação registrada."
            : `${total} registro(s) — exibindo ${items.length}`}
        </p>

        {loading && items.length === 0 ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            As movimentações aparecem ao receber mercadoria, reservar pedidos e expedir vendas.
          </p>
        ) : (
          <>
            <Table
              headers={[
                "Data",
                "Tipo",
                "SKU",
                "Unidade",
                "Qtd",
                "Status",
                "Referência",
                "Motivo",
              ]}
              rows={items.map((row) => {
                const refHref = movementReferenceHref(row.reference_type, row.reference_id);
                const statusText =
                  row.status_before || row.status_after
                    ? `${unitStatusLabel(row.status_before)} → ${unitStatusLabel(row.status_after)}`
                    : "—";

                return [
                  formatDateTime(row.created_at),
                  <span
                    key={`type-${row.id}`}
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${movementTypeBadgeClass(row.movement_type)}`}
                  >
                    {movementTypeLabel(row.movement_type)}
                  </span>,
                  <span key={`sku-${row.id}`} className="font-mono text-sm">
                    <span className="font-semibold">{row.sku_code}</span>
                    <span className="block text-xs text-slate-500">{row.sku_name}</span>
                  </span>,
                  row.unit_code ? (
                    <Link
                      key={`unit-${row.id}`}
                      href={`/estoque/unidades?code=${encodeURIComponent(row.unit_code)}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {row.unit_code}
                    </Link>
                  ) : (
                    "—"
                  ),
                  row.quantity === 0 ? "—" : String(row.quantity),
                  statusText,
                  refHref && row.reference_id ? (
                    <Link key={`ref-${row.id}`} href={refHref} className="text-blue-600 hover:underline">
                      {movementReferenceLabel(row.reference_type)} · {row.reference_id.slice(0, 8)}…
                    </Link>
                  ) : (
                    movementReferenceLabel(row.reference_type)
                  ),
                  row.reason ?? "—",
                ];
              })}
            />

            {hasMore ? (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="secondary" disabled={loading} onClick={onLoadMore}>
                  {loading ? "Carregando…" : "Carregar mais"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
