"use client";

import Link from "next/link";
import type { Customer, Order } from "@/lib/types";
import { customerProfileLabel, documentTypeLabel } from "@/lib/customer-profile";
import { Button, Card } from "@/components/ui";

type Props = {
  order: Order;
  customer: Customer | null;
  walkInId?: string;
  profileFallback?: string;
  brlRate: number | null;
  saleSummary: string;
  receiptHtml: string;
  printing: boolean;
  onPrint: () => void;
  onNewSale: () => void;
};

export function PDVSaleComplete({
  order,
  customer,
  walkInId,
  profileFallback,
  brlRate,
  saleSummary,
  receiptHtml,
  printing,
  onPrint,
  onNewSale,
}: Props) {
  return (
    <Card>
      <div className="space-y-4 text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-700">Venda concluída</p>
        <h2 className="text-2xl font-semibold text-slate-900">{order.order_number}</h2>
        <p className="text-slate-600">
          {customer ? (
            <>
              {customer.name}
              {" · "}
              {customerProfileLabel(customer, walkInId, profileFallback)}
              {customer.document_id
                ? ` · ${documentTypeLabel(customer.document_type)} ${customer.document_id}`
                : ""}
            </>
          ) : (
            "Consumidor final"
          )}
        </p>
        <p className="text-lg font-semibold text-slate-900">
          Total US$ {order.total_usd.toFixed(2)}
          {order.total_usd && brlRate
            ? ` · R$ ${(order.total_usd * brlRate).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : ""}
        </p>
        <p className="text-sm text-slate-500">{saleSummary}</p>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button type="button" disabled={printing || !receiptHtml} onClick={onPrint}>
            {printing ? "Abrindo…" : "Imprimir comprovante"}
          </Button>
          <Link href={`/pedidos/${order.id}`}>
            <Button type="button" variant="secondary">
              Ver pedido
            </Button>
          </Link>
          <Button type="button" variant="secondary" onClick={onNewSale}>
            Nova venda
          </Button>
        </div>
        {receiptHtml ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <iframe
              title={`Comprovante ${order.order_number}`}
              srcDoc={receiptHtml}
              className="h-[28rem] w-full bg-white"
              sandbox="allow-same-origin allow-modals allow-scripts"
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Carregando comprovante…</p>
        )}
      </div>
    </Card>
  );
}
