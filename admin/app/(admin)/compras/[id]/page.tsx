"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

type POItem = {
  id: string;
  sku_id: string;
  sku_code?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_usd: number;
  unit_landed_cost_usd?: number;
};

type POPayable = {
  id: string;
  status: string;
  amount_usd: number;
  amount_paid_usd: number;
};

type PO = {
  id: string;
  po_number: string;
  supplier_name?: string;
  status: string;
  import_origin?: string;
  origin_country_code?: string;
  intercompany_invoice_ref?: string;
  customs_declaration_ref?: string;
  incoterms?: string;
  freight_usd?: number;
  duties_usd?: number;
  landed_cost_usd?: number;
  payable?: POPayable | null;
  items?: POItem[];
};

function originLabel(po: PO): string {
  switch (po.import_origin) {
    case "china":
      return "Exportação China → Data Center LA";
    case "usa":
      return "Exportação EUA → Data Center LA";
    case "other":
      return `Exportação ${po.origin_country_code ?? "?"} → Data Center LA`;
    default:
      return "Compra local";
  }
}

export default function CompraDetailPage() {
  const params = useParams<{ id: string }>();
  const [po, setPo] = useState<PO | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<PO>(`/api/v1/purchases/orders/${params.id}`);
      setPo(data);
      const qty: Record<string, number> = {};
      for (const item of data.items ?? []) {
        const pending = item.quantity_ordered - item.quantity_received;
        qty[item.sku_id] = pending > 0 ? pending : 0;
      }
      setReceiveQty(qty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function receiveItems(items: { sku_id: string; quantity: number }[]) {
    await api(`/api/v1/purchases/orders/${params.id}/receive`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }

  async function receiveAll() {
    if (!po?.items?.length) return;
    setError("");
    setSubmitting(true);
    try {
      const items = po.items
        .filter((i) => i.quantity_received < i.quantity_ordered)
        .map((i) => ({
          sku_id: i.sku_id,
          quantity: i.quantity_ordered - i.quantity_received,
        }));
      if (!items.length) {
        setInfo("Nada pendente para receber");
        return;
      }
      await receiveItems(items);
      setInfo("Mercadoria recebida no estoque com custo landed rateado (frete + direitos). Próximo passo: inspeção/liberação em Estoque.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no recebimento");
    } finally {
      setSubmitting(false);
    }
  }

  async function receivePartial(e: FormEvent) {
    e.preventDefault();
    if (!po?.items?.length) return;
    setError("");
    setSubmitting(true);
    try {
      const items = po.items
        .map((i) => ({
          sku_id: i.sku_id,
          quantity: Math.min(receiveQty[i.sku_id] ?? 0, i.quantity_ordered - i.quantity_received),
        }))
        .filter((i) => i.quantity > 0);
      if (!items.length) {
        setError("Informe quantidades para receber");
        return;
      }
      await receiveItems(items);
      setInfo("Recebimento parcial registrado. Unidades entram no estoque com custo landed por SKU.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no recebimento");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (!po) return <Alert tone="error">{error || "PO não encontrada"}</Alert>;

  const canReceive = po.status === "ordered" || po.status === "partial";
  const pending = po.items?.some((i) => i.quantity_received < i.quantity_ordered);
  const isImport = po.import_origin && po.import_origin !== "local";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link href="/compras" className="text-sm text-blue-600 hover:underline">← Compras</Link>
        <h1 className="mt-2 text-2xl font-semibold">{po.po_number}</h1>
        <p className="text-sm text-slate-600">
          {po.supplier_name} · {originLabel(po)} · {po.status}
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      {po.payable ? (
        <Card title="Conta a pagar">
          <p className="text-sm text-slate-600">
            Valor USD {po.payable.amount_usd.toFixed(2)} · pago {po.payable.amount_paid_usd.toFixed(2)} · status {po.payable.status}
          </p>
          <Link href="/financeiro" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Abrir financeiro para quitar
          </Link>
        </Card>
      ) : null}

      {isImport ? (
        <Card title="Exportação → Data Center LA">
          <p className="mb-3 text-xs text-slate-500">
            Exportador: <strong>{po.supplier_name ?? "—"}</strong>
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Invoice exportação</dt><dd>{po.intercompany_invoice_ref ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Declaração aduaneira</dt><dd>{po.customs_declaration_ref ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Incoterms</dt><dd>{po.incoterms ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Frete USD</dt><dd>${(po.freight_usd ?? 0).toFixed(2)}</dd></div>
            <div><dt className="text-slate-500">Direitos USD</dt><dd>${(po.duties_usd ?? 0).toFixed(2)}</dd></div>
            <div><dt className="text-slate-500">Landed cost total</dt><dd><strong>${(po.landed_cost_usd ?? 0).toFixed(2)}</strong></dd></div>
          </dl>
        </Card>
      ) : null}

      <Card title="Itens">
        <Table
          headers={["SKU", "Pedido", "Recebido", "Pendente", "Custo base", "Custo landed/un."]}
          rows={(po.items ?? []).map((i) => [
            i.sku_code ?? i.sku_id.slice(0, 8),
            i.quantity_ordered,
            i.quantity_received,
            i.quantity_ordered - i.quantity_received,
            `$${i.unit_cost_usd.toFixed(2)}`,
            `$${(i.unit_landed_cost_usd ?? i.unit_cost_usd).toFixed(2)}`,
          ])}
        />
        {(po.freight_usd ?? 0) + (po.duties_usd ?? 0) > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Custo landed/un. inclui rateio proporcional de frete e direitos no recebimento ao estoque.
          </p>
        ) : null}
      </Card>

      {pending && canReceive ? (
        <Card title="Recebimento">
          <form className="space-y-4" onSubmit={receivePartial}>
            <p className="text-sm text-slate-600">
              Unidades entram como <strong>received</strong>. Conclua inspeção e liberação em{" "}
              <Link href="/estoque/entrada/recebimento" className="text-blue-600 hover:underline">Recebimento</Link>.
            </p>
            <div className="space-y-3">
              {(po.items ?? [])
                .filter((i) => i.quantity_received < i.quantity_ordered)
                .map((i) => (
                  <div key={i.sku_id} className="grid gap-2 sm:grid-cols-2 items-end">
                    <p className="text-sm text-slate-700">
                      {i.sku_code ?? i.sku_id.slice(0, 8)} — pendente {i.quantity_ordered - i.quantity_received}
                      {" "}(landed ${(i.unit_landed_cost_usd ?? i.unit_cost_usd).toFixed(2)}/un.)
                    </p>
                    <Field label="Receber agora">
                      <Input
                        type="number"
                        min={0}
                        max={i.quantity_ordered - i.quantity_received}
                        value={receiveQty[i.sku_id] ?? 0}
                        onChange={(e) =>
                          setReceiveQty((p) => ({
                            ...p,
                            [i.sku_id]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                      />
                    </Field>
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Processando…" : "Receber parcial"}
              </Button>
              <Button type="button" variant="secondary" disabled={submitting} onClick={() => void receiveAll()}>
                Receber tudo pendente
              </Button>
            </div>
          </form>
        </Card>
      ) : po.status === "received" ? (
        <Alert tone="success">
          PO recebida.{" "}
          <Link href="/estoque/entrada/recebimento" className="font-medium text-blue-700 hover:underline">Ir para Recebimento</Link>
          {" "}para inspeção e liberação das unidades.
        </Alert>
      ) : null}
    </div>
  );
}
