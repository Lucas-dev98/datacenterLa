"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { LowStockSKU, StockBalanceRow } from "@/lib/types";
import { Alert, Button, Card, Input, Table } from "@/components/ui";

const LOW_STOCK_THRESHOLD = 2;

export default function EstoquePosicaoPage() {
  const searchParams = useSearchParams();
  const lowStockMode = searchParams.get("estoque_baixo") === "1";
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockBalanceRow[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockSKU[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      if (lowStockMode) {
        const params = new URLSearchParams({
          threshold: String(LOW_STOCK_THRESHOLD),
          limit: "200",
        });
        if (q.trim()) params.set("q", q.trim());
        const res = await api<{ items: LowStockSKU[]; total: number; threshold: number }>(
          `/api/v1/stock/low-stock?${params}`,
        );
        setLowStockItems(res.items ?? []);
        setItems([]);
        setTotal(res.total ?? 0);
      } else {
        const params = new URLSearchParams({
          warehouse_id: DEFAULT_WAREHOUSE_ID,
          limit: "100",
        });
        if (q.trim()) params.set("q", q.trim());
        const res = await api<{ items: StockBalanceRow[]; total: number }>(
          `/api/v1/stock/balances?${params}`,
        );
        setItems(res.items ?? []);
        setLowStockItems([]);
        setTotal(res.total ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar posição");
    } finally {
      setLoading(false);
    }
  }, [lowStockMode]);

  useEffect(() => {
    void load("");
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(query);
  }

  const totals = items.reduce(
    (acc, row) => ({
      physical: acc.physical + row.qty_physical,
      reserved: acc.reserved + row.qty_reserved,
      available: acc.available + row.qty_available,
    }),
    { physical: 0, reserved: 0, available: 0 },
  );

  const lowStockTotals = lowStockItems.reduce(
    (acc, row) => ({
      physical: acc.physical + (row.qty_physical ?? 0),
      reserved: acc.reserved + (row.qty_reserved ?? 0),
      available: acc.available + row.qty_available,
    }),
    { physical: 0, reserved: 0, available: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/estoque" className="hover:underline">
            Estoque
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {lowStockMode ? "Estoque crítico" : "Posição de estoque"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {lowStockMode
            ? `SKUs ativos com disponível total ≤ ${LOW_STOCK_THRESHOLD} un. em todos os depósitos — mesma regra do dashboard.`
            : "Saldo por SKU no depósito principal — unidades físicas, reservadas e disponíveis."}
        </p>
        {lowStockMode ? (
          <Link href="/estoque/posicao" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Ver posição completa por depósito
          </Link>
        ) : (
          <Link
            href="/estoque/posicao?estoque_baixo=1"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            Ver apenas estoque crítico (≤ {LOW_STOCK_THRESHOLD} un.)
          </Link>
        )}
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {lowStockMode ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="SKUs críticos" value={total} />
          <Stat label="Físico (total)" value={lowStockTotals.physical} />
          <Stat label="Disponível (total)" value={lowStockTotals.available} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Físico (página)" value={totals.physical} />
          <Stat label="Reservado" value={totals.reserved} />
          <Stat label="Disponível" value={totals.available} />
        </div>
      )}

      <Card>
        <form className="mb-4 flex flex-wrap gap-3" onSubmit={onSearch}>
          <Input
            className="max-w-sm font-mono"
            placeholder="Código ou nome do SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            Buscar
          </Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void load(query)}>
            Atualizar
          </Button>
        </form>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : lowStockMode ? (
          lowStockItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum SKU com estoque crítico no momento.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {lowStockItems.length} de {total} SKU(s) com estoque crítico
              </p>
              <Table
                headers={["SKU", "Produto", "Físico", "Reservado", "Disponível"]}
                rows={lowStockItems.map((row) => [
                  <span key={`c-${row.sku_code}`} className="font-mono font-medium">
                    {row.sku_code}
                  </span>,
                  row.name ?? row.sku_name ?? "",
                  row.qty_physical ?? 0,
                  row.qty_reserved ?? 0,
                  <span key={`a-${row.sku_code}`} className="font-semibold text-amber-700">
                    {row.qty_available}
                  </span>,
                ])}
              />
            </>
          )
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum saldo encontrado. Cadastre SKUs em{" "}
            <Link href="/produtos" className="text-blue-600 hover:underline">
              Cadastro
            </Link>{" "}
            e receba mercadoria em{" "}
            <Link href="/estoque/entrada" className="text-blue-600 hover:underline">
              Entrada
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Exibindo {items.length} de {total} SKU(s) com saldo no depósito principal
            </p>
            <Table
              headers={["SKU", "Produto", "Físico", "Reservado", "Disponível"]}
              rows={items.map((row) => [
                <span key={`c-${row.sku_id}`} className="font-mono font-medium">
                  {row.sku_code}
                </span>,
                row.sku_name,
                row.qty_physical,
                row.qty_reserved,
                <span
                  key={`a-${row.sku_id}`}
                  className={row.qty_available <= LOW_STOCK_THRESHOLD ? "font-semibold text-amber-700" : ""}
                >
                  {row.qty_available}
                </span>,
              ])}
            />
          </>
        )}
      </Card>

      <p className="text-sm text-slate-500">
        Consulte uma unidade específica pelo código AAA em{" "}
        <Link href="/estoque/unidades" className="text-blue-600 hover:underline">
          Unidades
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-100 px-4 py-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
