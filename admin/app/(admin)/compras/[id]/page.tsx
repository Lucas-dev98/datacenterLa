"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePurchaseOrderDetail } from "@/hooks/use-purchase-order-detail";
import type { PurchaseOrderDetail } from "@/lib/api/purchases";
import { Alert, Button, Card, Table } from "@/components/ui";

type PO = PurchaseOrderDetail;

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
  const { data: po, error, loading } = usePurchaseOrderDetail(params.id);

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (!po) return <Alert tone="error">{error || "PO não encontrada"}</Alert>;

  const canReceive = po.status === "ordered" || po.status === "partial";
  const pending = po.items?.some((i) => i.quantity_received < i.quantity_ordered);
  const isImport = po.import_origin && po.import_origin !== "local";
  const receiveHref = `/estoque/entrada/compras/${po.id}/receber`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link href="/compras" className="text-sm text-blue-600 hover:underline">
          ← Compras
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{po.po_number}</h1>
        <p className="text-sm text-slate-600">
          {po.supplier_name} · {originLabel(po)} · {po.status}
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {po.payable ? (
        <Card title="Conta a pagar">
          <p className="text-sm text-slate-600">
            Valor USD {po.payable.amount_usd.toFixed(2)} · pago {po.payable.amount_paid_usd.toFixed(2)} · status{" "}
            {po.payable.status}
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
            <div>
              <dt className="text-slate-500">Invoice exportação</dt>
              <dd>{po.intercompany_invoice_ref ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Declaração aduaneira</dt>
              <dd>{po.customs_declaration_ref ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Incoterms</dt>
              <dd>{po.incoterms ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Frete USD</dt>
              <dd>${(po.freight_usd ?? 0).toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Direitos USD</dt>
              <dd>${(po.duties_usd ?? 0).toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Landed cost total</dt>
              <dd>
                <strong>${(po.landed_cost_usd ?? 0).toFixed(2)}</strong>
              </dd>
            </div>
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
        <Card title="Recebimento físico">
          <p className="text-sm text-slate-600">
            O recebimento passa pelo fluxo com fotos do lote, códigos AAA nas unidades e testes na fila de
            recebimento. Use o assistente dedicado em Estoque → Entrada.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={receiveHref}>
              <Button type="button">Receber mercadoria (fotos + códigos)</Button>
            </Link>
            <Link href="/estoque/entrada/compras">
              <Button type="button" variant="secondary">
                Ver POs pendentes
              </Button>
            </Link>
          </div>
        </Card>
      ) : po.status === "received" ? (
        <Alert tone="success">
          PO recebida.{" "}
          <Link href="/estoque/entrada/recebimento" className="font-medium text-blue-700 hover:underline">
            Ir para fila de recebimento
          </Link>{" "}
          para testes e liberação das unidades.
        </Alert>
      ) : null}
    </div>
  );
}
