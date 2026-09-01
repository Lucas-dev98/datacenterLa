"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  useResolveStockHealthIssue,
  useStockHealthScan,
} from "@/hooks/use-stock-health-mutations";
import { stockApi, type HealthIssue, type HealthStats, type ExpiringReservation } from "@/lib/api/stock";
import { Alert, Button, Card, Table } from "@/components/ui";

export default function EstoqueSaudePage() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [expiring, setExpiring] = useState<ExpiringReservation[]>([]);
  const [issues, setIssues] = useState<HealthIssue[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const { run: healthScan, loading: scanning } = useStockHealthScan();
  const { run: resolveIssue, loading: resolving } = useResolveStockHealthIssue();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await stockApi.healthDashboard();
      setStats(data.stats);
      setExpiring(data.expiring_reservations ?? []);
      setIssues(data.open_issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function scan() {
    setInfo("");
    setError("");
    try {
      const res = await healthScan({});
      setInfo(`${res.detected} nova(s) inconsistência(s) detectada(s)`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no scan");
    }
  }

  async function resolve(id: string) {
    setError("");
    try {
      await resolveIssue(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao resolver");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/estoque" className="hover:underline">
              Estoque
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Saúde do estoque</h1>
          <p className="mt-1 text-sm text-slate-600">KPIs, reservas expirando e inconsistências</p>
        </div>
        <Button type="button" onClick={() => void scan()} disabled={scanning}>
          {scanning ? "Executando…" : "Executar scan"}
        </Button>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      {loading || !stats ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Unidades" value={stats.total_units} />
            <Stat label="Disponíveis" value={stats.available_units} />
            <Stat label="Reservadas" value={stats.reserved_units} />
            <Stat label="Issues abertas" value={stats.open_issues} />
            <Stat label="Reservas ≤48h" value={stats.expiring_reservations} />
            <Stat label="SKUs baixo" value={stats.low_stock_skus} />
          </div>

          {Object.keys(stats.units_by_status ?? {}).length > 0 ? (
            <Card title="Unidades por status">
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.units_by_status).map(([status, count]) => (
                  <div key={status} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-900">{count}</span>
                    <span className="ml-2 text-slate-600">{status}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Reservas expirando (48h)">
            {expiring.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma reserva próxima do vencimento.</p>
            ) : (
              <Table
                headers={["Pedido", "SKU", "Expira em", ""]}
                rows={expiring.map((r) => [
                  r.order_number ?? r.order_id.slice(0, 8),
                  r.sku_code,
                  new Date(r.expires_at).toLocaleString("pt-BR"),
                  "—",
                ])}
              />
            )}
          </Card>

          <Card title="Inconsistências abertas">
            {issues.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma issue aberta.</p>
            ) : (
              <Table
                headers={["Tipo", "Unidade", "SKU", "Detectado", ""]}
                rows={issues.map((i) => [
                  i.issue_type,
                  i.unit_code ?? "—",
                  i.sku_code ?? "—",
                  new Date(i.detected_at).toLocaleString("pt-BR"),
                  <button
                    key="r"
                    type="button"
                    className="text-blue-600 hover:underline disabled:opacity-50"
                    disabled={resolving}
                    onClick={() => void resolve(i.id)}
                  >
                    Resolver
                  </button>,
                ])}
              />
            )}
          </Card>
        </>
      )}
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
