"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { useAuth } from "@/components/auth-provider";
import type { FeedSyncLog, FeedSyncLogDetail, FeedDiagnostics } from "@/lib/types";
import { Alert, Button, Card, Table } from "@/components/ui";

export default function ComprasParaguaiPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<FeedSyncLog[]>([]);
  const [diagnostics, setDiagnostics] = useState<FeedDiagnostics | null>(null);
  const [selected, setSelected] = useState<FeedSyncLogDetail | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const canRun = hasPermission(user, "pim.products.write");

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const [res, diag] = await Promise.all([
        api<{ items: FeedSyncLog[] }>("/api/v1/integrations/compras-paraguai/sync/logs?limit=30"),
        api<FeedDiagnostics>("/api/v1/integrations/compras-paraguai/sync/diagnostics"),
      ]);
      setLogs(res.items ?? []);
      setDiagnostics(diag);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  async function runSync() {
    setSyncing(true);
    setInfo("");
    setError("");
    try {
      await api("/api/v1/integrations/compras-paraguai/sync/run", { method: "POST" });
      setInfo("Sincronização concluída");
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function openLog(id: string) {
    setError("");
    try {
      const log = await api<FeedSyncLogDetail>(
        `/api/v1/integrations/compras-paraguai/sync/logs/${id}`,
      );
      setSelected(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar log");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Compras Paraguai</h1>
          <p className="mt-1 text-sm text-slate-600">
            Feed XML · logs de sincronização ·{" "}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1/integrations/compras-paraguai/feed.xml`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              ver feed público
            </a>
          </p>
        </div>
        {canRun ? (
          <Button type="button" disabled={syncing} onClick={() => void runSync()}>
            {syncing ? "Sincronizando…" : "Sincronizar agora"}
          </Button>
        ) : null}
      </header>

      {info ? <Alert tone="success">{info}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {diagnostics ? (
        <Card title="Diagnóstico do feed">
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Incluídos</p>
              <p className="text-lg font-semibold text-emerald-700">{diagnostics.included_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Ignorados</p>
              <p className="text-lg font-semibold text-amber-700">{diagnostics.skipped_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Não publicados</p>
              <p className="text-lg font-semibold text-slate-700">{diagnostics.unpublished_count}</p>
            </div>
          </div>
          {diagnostics.items.length > 0 ? (
            <Table
              headers={["SKU", "Status", "Estoque", "Preço B2C", "Motivo"]}
              rows={diagnostics.items.slice(0, 50).map((item) => [
                item.sku_code,
                item.status,
                item.stock_available,
                item.price_b2c_usd != null ? `$${item.price_b2c_usd.toFixed(2)}` : "—",
                item.reason ?? "—",
              ])}
            />
          ) : (
            <p className="text-sm text-slate-500">Nenhum SKU cadastrado.</p>
          )}
          {diagnostics.items.length > 50 ? (
            <p className="mt-2 text-xs text-slate-500">Mostrando 50 de {diagnostics.items.length} SKUs.</p>
          ) : null}
        </Card>
      ) : null}

      <Card title="Histórico de sync">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum log ainda. Dispare uma sincronização.</p>
        ) : (
          <Table
            headers={["Data", "Status", "Itens", "Ignorados", "Origem", "Duração", ""]}
            rows={logs.map((log) => [
              new Date(log.created_at).toLocaleString("pt-BR"),
              log.status,
              log.item_count,
              log.skipped_count,
              log.trigger_source,
              log.duration_ms != null ? `${log.duration_ms} ms` : "—",
              <button
                key="d"
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => void openLog(log.id)}
              >
                Detalhe
              </button>,
            ])}
          />
        )}
      </Card>

      {selected ? (
        <Card title={`Log ${selected.id.slice(0, 8)}…`}>
          <p className="mb-3 text-sm text-slate-600">
            Status: <strong>{selected.status}</strong>
            {selected.error_message ? ` · ${selected.error_message}` : ""}
          </p>
          {selected.entries?.length ? (
            <Table
              headers={["SKU", "Ação", "Motivo"]}
              rows={selected.entries.map((e) => [
                e.sku_code,
                e.action,
                e.reason ?? "—",
              ])}
            />
          ) : (
            <p className="text-sm text-slate-500">Sem entradas detalhadas.</p>
          )}
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setSelected(null)}>
            Fechar
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
