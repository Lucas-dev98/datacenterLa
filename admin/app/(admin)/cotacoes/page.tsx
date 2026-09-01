"use client";

import Link from "next/link";
import { useState } from "react";
import { useUpdateWebsiteRequestStatus } from "@/hooks/use-quote-mutations";
import { useQuotesList, useWebsiteRequestsList } from "@/hooks/use-quotes-list";
import { Alert, Button, Card, Select, Table } from "@/components/ui";

function cleanNotes(notes?: string): string {
  if (!notes?.trim()) return "—";
  return notes.replace(/^Cotação pelo site:\s*/i, "").trim() || "—";
}

export default function CotacoesPage() {
  const [status, setStatus] = useState("");
  const [websiteError, setWebsiteError] = useState("");
  const {
    data: quotesData,
    error: quotesError,
    loading: quotesLoading,
  } = useQuotesList(status);
  const {
    data: website,
    error: websiteLoadError,
    refetch: refetchWebsite,
  } = useWebsiteRequestsList();
  const { run: updateWebsiteStatus, loading: updatingWebsite } = useUpdateWebsiteRequestStatus();
  const [pendingWebsiteId, setPendingWebsiteId] = useState<string | null>(null);

  const items = quotesData?.items ?? [];
  const total = quotesData?.total ?? 0;
  const websiteItems = website ?? [];
  const error = quotesError;
  const newWebsite = websiteItems.filter((w) => w.status === "new").length;

  async function setWebsiteStatus(id: string, next: string) {
    setPendingWebsiteId(id);
    setWebsiteError("");
    try {
      await updateWebsiteStatus({ id, status: next });
      await refetchWebsite();
    } catch (err) {
      setWebsiteError(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setPendingWebsiteId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotações</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} cotação(ões) B2B
            {websiteItems.length > 0
              ? ` · ${websiteItems.length} solicitação(ões) do site${newWebsite ? ` (${newWebsite} nova${newWebsite > 1 ? "s" : ""})` : ""}`
              : ""}
          </p>
        </div>
        <Link href="/cotacoes/nova">
          <Button>Nova cotação</Button>
        </Link>
      </header>

      <Card title="Solicitações do site">
        <p className="mb-4 text-sm text-slate-600">
          Pedidos enviados pelo formulário de cotação da loja (`/contato`).
        </p>
        {websiteError || websiteLoadError ? (
          <Alert tone="error">{websiteError || websiteLoadError}</Alert>
        ) : null}
        {websiteItems.length === 0 && !websiteError && !websiteLoadError ? (
          <p className="text-sm text-slate-500">Nenhuma solicitação do site ainda.</p>
        ) : websiteItems.length > 0 ? (
          <div className="space-y-3">
            {websiteItems.map((w) => (
              <article
                key={w.id}
                className={`rounded-lg border p-4 ${
                  w.status === "new" ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{w.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {[w.email, w.phone, w.company].filter(Boolean).join(" · ") || "Sem contato extra"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                      {w.status}
                    </span>
                    <span className="text-slate-500">
                      {new Date(w.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{cleanNotes(w.notes)}</p>
                {w.status === "new" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={updatingWebsite && pendingWebsiteId === w.id}
                      onClick={() => void setWebsiteStatus(w.id, "contacted")}
                    >
                      Marcar contato
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={updatingWebsite && pendingWebsiteId === w.id}
                      onClick={() => void setWebsiteStatus(w.id, "qualified")}
                    >
                      Qualificar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={updatingWebsite && pendingWebsiteId === w.id}
                      onClick={() => void setWebsiteStatus(w.id, "lost")}
                    >
                      Perdido
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="Filtros — cotações B2B">
        <Select className="max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="sent">Enviada</option>
          <option value="approved">Aceita</option>
          <option value="rejected">Rejeitada</option>
          <option value="expired">Expirada</option>
        </Select>
      </Card>

      <Card title="Cotações B2B">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {quotesLoading ? (
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
