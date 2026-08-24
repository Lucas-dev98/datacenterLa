"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { QuoteListItem } from "@/lib/types";
import { Alert, Button, Card, Select, Table } from "@/components/ui";

export default function CotacoesPage() {
  const [items, setItems] = useState<QuoteListItem[]>([]);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const q = status ? `&status=${encodeURIComponent(status)}` : "";
        const res = await api<{ items: QuoteListItem[]; total: number }>(
          `/api/v1/sales/quotes?limit=50${q}`,
        );
        setItems(res.items);
        setTotal(res.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [status]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotações</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} cotação(ões) · CRM B2B
          </p>
        </div>
        <Link href="/cotacoes/nova">
          <Button>Nova cotação</Button>
        </Link>
      </header>

      <Card title="Filtros">
        <Select className="max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="sent">Enviada</option>
          <option value="accepted">Aceita</option>
          <option value="rejected">Rejeitada</option>
          <option value="expired">Expirada</option>
        </Select>
      </Card>

      <Card title="Lista">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma cotação encontrada.</p>
        ) : (
          <Table
            headers={["Número", "Cliente", "Status", "Canal", "Total", "Data", ""]}
            rows={items.map((q) => [
              <span key="n" className="font-mono font-medium">{q.quote_number}</span>,
              q.customer_name,
              q.status,
              q.channel,
              `$${q.total_usd.toFixed(2)}`,
              new Date(q.created_at).toLocaleDateString("pt-BR"),
              <Link key="l" href={`/cotacoes/${q.id}`} className="text-blue-600 hover:underline">
                Ver
              </Link>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
