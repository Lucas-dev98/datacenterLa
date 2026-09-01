"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { salesApi } from "@/lib/api/sales";
import { orderChannelLabel } from "@/lib/order-channels";
import type { AnalyticsDashboard } from "@/lib/types";
import { AbcParetoChart } from "@/components/abc-pareto-chart";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const ABC_CLASS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-amber-100 text-amber-800",
  C: "bg-slate-100 text-slate-700",
};

export default function AnalyticsPage() {
  const initial = defaultPeriod();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [channel, setChannel] = useState("");
  const [metric, setMetric] = useState<"revenue" | "quantity">("revenue");
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await salesApi.analyticsDashboard({ from, to, metric, channel: channel || undefined });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar análise");
    } finally {
      setLoading(false);
    }
  }, [from, to, channel, metric]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void load();
  }

  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/financeiro" className="hover:underline">
            Financeiro
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">KPIs e Curva ABC</h1>
        <p className="mt-1 text-sm text-slate-600">
          Produtos que mais saem — receita, quantidade, margem e classificação Pareto (A · B · C).
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card title="Filtros">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={onSubmit}>
          <Field label="De">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </Field>
          <Field label="Canal">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Todos</option>
              <option value="erp">ERP / B2B</option>
              <option value="ecommerce">E-commerce</option>
              <option value="store">Loja física</option>
            </Select>
          </Field>
          <Field label="Curva ABC por">
            <Select value={metric} onChange={(e) => setMetric(e.target.value as "revenue" | "quantity")}>
              <option value="revenue">Receita (USD)</option>
              <option value="quantity">Quantidade vendida</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Carregando…" : "Aplicar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const p = defaultPeriod();
                setFrom(p.from);
                setTo(p.to);
                setChannel("");
              }}
            >
              Mês atual
            </Button>
          </div>
        </form>
        {data?.channel ? (
          <p className="mt-3 text-xs text-slate-500">Canal: {orderChannelLabel(data.channel)}</p>
        ) : null}
      </Card>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Receita expedida" value={`$${summary.revenue_usd.toFixed(2)}`} />
            <Kpi label="Unidades vendidas" value={String(summary.units_sold)} sub={`${summary.orders_count} pedido(s)`} />
            <Kpi
              label="Margem bruta"
              value={`$${summary.gross_margin_usd.toFixed(2)}`}
              sub={`${summary.gross_margin_pct.toFixed(1)}% · COGS $${summary.cogs_usd.toFixed(2)}`}
            />
            <Kpi
              label="SKUs vendidos"
              value={String(summary.skus_sold)}
              sub={`ABC: ${summary.class_a_count} A · ${summary.class_b_count} B · ${summary.class_c_count} C`}
            />
          </div>

          {(data?.products ?? []).length > 0 ? (
            <Card title="Gráfico Pareto — curva ABC">
              <AbcParetoChart products={data.products} metric={metric} />
            </Card>
          ) : null}

          <Card title="Curva ABC — ranking de produtos">
            {(data?.products ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma venda expedida no período selecionado.</p>
            ) : (
              <>
                <p className="mb-4 text-xs text-slate-500">
                  Classe A ≈ 80% do {metric === "revenue" ? "faturamento" : "volume"} · B até 95% · C restante.
                  Ordenado por {metric === "revenue" ? "receita" : "quantidade"}.
                </p>
                <Table
                  headers={["#", "ABC", "SKU", "Produto", "Qtd", "Receita", "Margem", "Share", "Acum."]}
                  rows={(data?.products ?? []).map((row, index) => [
                    index + 1,
                    <span
                      key={`abc-${row.sku_id}`}
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${ABC_CLASS[row.abc_class] ?? ABC_CLASS.C}`}
                    >
                      {row.abc_class}
                    </span>,
                    <span key={`code-${row.sku_id}`} className="font-mono text-sm">
                      {row.sku_code}
                    </span>,
                    row.sku_name,
                    row.qty_sold,
                    `$${row.revenue_usd.toFixed(2)}`,
                    `$${row.margin_usd.toFixed(2)} (${row.margin_pct.toFixed(0)}%)`,
                    `${row.share_pct.toFixed(1)}%`,
                    <div key={`bar-${row.sku_id}`} className="min-w-[5rem]">
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(row.cumulative_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{row.cumulative_pct.toFixed(1)}%</span>
                    </div>,
                  ])}
                />
              </>
            )}
          </Card>
        </>
      ) : loading ? (
        <p className="text-sm text-slate-500">Carregando KPIs…</p>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
