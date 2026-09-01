"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useSalesDashboard } from "@/hooks/use-sales-dashboard";
import { hasPermission } from "@/lib/permissions";
import { Alert, Card, Table } from "@/components/ui";

const EXPEDITION_STATUS: Record<string, string> = {
  confirmed: "Confirmado",
  paid: "Pago",
  picking: "Em separação",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error: loadError, loading } = useSalesDashboard();
  const [error, setError] = useState("");
  const canSeeFinance = hasPermission(user, "finance.receivables.read");

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  if (loading) return <p className="text-slate-500">Carregando…</p>;

  const stats = data?.stats;
  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visão operacional — estoque como fonte única de verdade.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Vendas do mês"
            value={`$${stats.sales_month_usd.toFixed(2)}`}
            sub={`${stats.sales_month_orders} pedido(s) expedido(s) · ${monthLabel}`}
            href="/financeiro/analytics"
            accent
          />
          <StatCard label="Pedidos rascunho" value={stats.orders_draft} href="/pedidos?status=draft" />
          <StatCard
            label="Aguardando expedição"
            value={stats.orders_pending_ship}
            href="/estoque/saida/expedicao"
          />
          <StatCard label="Cotações abertas" value={stats.quotes_open} href="/cotacoes" />
          {canSeeFinance ? (
            <StatCard
              label="A receber (USD)"
              value={`$${stats.receivables_outstanding_usd.toFixed(2)}`}
              sub={`${stats.receivables_open} título(s)`}
              href="/financeiro"
            />
          ) : null}
          <StatCard
            label="SKUs estoque baixo"
            value={stats.skus_low_stock}
            href="/estoque/posicao?estoque_baixo=1"
            warn={stats.skus_low_stock > 0}
          />
          <StatCard label="SKUs ativos" value={stats.active_skus} href="/produtos" />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Fila de expedição">
          {(data?.pending_orders ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum pedido aguardando expedição.</p>
          ) : (
            <Table
              headers={["Pedido", "Cliente", "Status", "Total", ""]}
              rows={(data?.pending_orders ?? []).map((o) => [
                <span key="n" className="font-mono text-sm">{o.order_number}</span>,
                o.customer_name,
                EXPEDITION_STATUS[o.status] ?? o.status,
                `$${o.total_usd.toFixed(2)}`,
                <Link key="l" href={`/pedidos/${o.id}`} className="text-blue-600 hover:underline">
                  Ver
                </Link>,
              ])}
            />
          )}
        </Card>

        <Card title="Estoque baixo (≤ 2 un. total)">
          {(data?.low_stock_skus ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum SKU com estoque crítico.</p>
          ) : (
            <>
              <Table
                headers={["SKU", "Produto", "Disponível"]}
                rows={(data?.low_stock_skus ?? []).map((s) => [
                  <span key="c" className="font-mono">{s.sku_code}</span>,
                  s.name,
                  s.qty_available,
                ])}
              />
              {stats && stats.skus_low_stock > (data?.low_stock_skus ?? []).length ? (
                <p className="mt-3 text-xs text-slate-500">
                  Mostrando {(data?.low_stock_skus ?? []).length} de {stats.skus_low_stock}.{" "}
                  <Link href="/estoque/posicao?estoque_baixo=1" className="text-blue-600 hover:underline">
                    Ver todos
                  </Link>
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  <Link href="/estoque/posicao?estoque_baixo=1" className="text-blue-600 hover:underline">
                    Ver lista completa
                  </Link>
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
  accent,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const border = warn ? "border-amber-300 bg-amber-50" : accent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white";
  return (
    <Link href={href}>
      <div className={`rounded-xl border p-4 shadow-sm transition hover:shadow-md ${border}`}>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
      </div>
    </Link>
  );
}
