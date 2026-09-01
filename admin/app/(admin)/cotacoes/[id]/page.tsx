"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useConvertQuote, useSendQuote } from "@/hooks/use-quote-mutations";
import { useQuoteDetail } from "@/hooks/use-quotes-list";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { Alert, Button, Card, Table } from "@/components/ui";

export default function CotacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: quote, error: loadError, loading, setData: setQuote } = useQuoteDetail(params.id);
  const [info, setInfo] = useState("");
  const [actionError, setActionError] = useState("");
  const { run: sendQuoteMutation, loading: sending } = useSendQuote();
  const { run: convertQuote, loading: converting } = useConvertQuote();

  const error = actionError || loadError;

  async function sendQuote() {
    setInfo("");
    setActionError("");
    try {
      const q = await sendQuoteMutation(params.id);
      setQuote(q);
      setInfo("Cotação enviada — pronta para converter em pedido");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao enviar");
    }
  }

  async function convertToOrder() {
    setActionError("");
    setInfo("");
    try {
      const o = await convertQuote({ id: params.id, body: { warehouse_id: DEFAULT_WAREHOUSE_ID } });
      setInfo(`Pedido ${o.order_number} criado`);
      router.push(`/pedidos/${o.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao converter");
    }
  }

  if (loading) return <p className="text-slate-500">Carregando…</p>;
  if (!quote) return error ? <Alert tone="error">{error}</Alert> : null;

  const canConvert = quote.status === "sent" || quote.status === "approved";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/cotacoes" className="text-sm text-blue-600 hover:underline">
          ← Cotações
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Cotação {quote.quote_number}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Status: <strong>{quote.status}</strong> · Total: <strong>USD {quote.total_usd.toFixed(2)}</strong>
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Itens">
        <Table
          headers={["SKU ID", "Qtd", "Preço unit.", "Total linha"]}
          rows={(quote.items ?? []).map((item) => [
            item.sku_id.slice(0, 8) + "…",
            item.quantity,
            `$${item.unit_price_usd.toFixed(2)}`,
            `$${item.line_total_usd.toFixed(2)}`,
          ])}
        />
      </Card>

      <div className="flex flex-wrap gap-3">
        {quote.status === "draft" ? (
          <Button type="button" disabled={sending} onClick={() => void sendQuote()}>
            {sending ? "Enviando…" : "Enviar cotação"}
          </Button>
        ) : null}
        {canConvert ? (
          <Button type="button" variant="secondary" disabled={converting} onClick={() => void convertToOrder()}>
            {converting ? "Convertendo…" : "Converter em pedido"}
          </Button>
        ) : null}
        {quote.status === "converted" ? (
          <Link href="/pedidos">
            <Button variant="secondary" type="button">
              Ver pedidos
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
