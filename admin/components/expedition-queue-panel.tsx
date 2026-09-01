"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { salesApi } from "@/lib/api/sales";
import { orderChannelBadgeClass, orderChannelLabel } from "@/lib/order-channels";
import type { OrderListItem } from "@/lib/types";
import { ShipExpeditionModal } from "@/components/ship-expedition-modal";
import { useAuth } from "@/components/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { Alert, Button, Card, Table } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado — aguardando separação",
  paid: "Pago — aguardando separação",
  picking: "Em separação",
};

type Props = {
  sectionLabel?: string;
  title?: string;
  description?: string;
};

export function ExpeditionQueuePanel({
  sectionLabel = "Saída",
  title = "Fila de expedição",
  description = "Pedidos confirmados ou pagos aguardando separação — e-commerce, loja física e ERP. Ao expedir, fotografe cada item que está saindo.",
}: Props) {
  const { user } = useAuth();
  const canShip = hasPermission(user, "sales.orders.confirm");

  const [items, setItems] = useState<OrderListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shipQueue, setShipQueue] = useState<OrderListItem[]>([]);
  const [activeShip, setActiveShip] = useState<OrderListItem | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await salesApi.listExpeditionQueue();
      setItems(list);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fila");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((o) => o.id)));
  }

  function beginShip(orders: OrderListItem[]) {
    if (orders.length === 0 || !canShip) return;
    setBulkConfirm(null);
    setShipQueue(orders);
    setActiveShip(orders[0]);
  }

  function onShippedOne() {
    setInfo("Pedido expedido — estoque baixado");
    const rest = shipQueue.slice(1);
    setShipQueue(rest);
    if (rest.length > 0) {
      setActiveShip(rest[0]);
    } else {
      setActiveShip(null);
      void load();
    }
  }

  function closeShipModal() {
    setActiveShip(null);
    setShipQueue([]);
  }

  function onShipAll(e: FormEvent) {
    e.preventDefault();
    const orders = items.filter((o) => selected.has(o.id));
    if (orders.length === 0) return;
    setBulkConfirm(orders);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/estoque/saida" className="hover:underline">
              {sectionLabel}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {!canShip ? (
        <Alert tone="error">
          Seu usuário não tem permissão para expedir pedidos (<code>sales.orders.confirm</code>). Solicite ao
          administrador.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card>
        {bulkConfirm ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              Expedir <strong>{bulkConfirm.length}</strong> pedido(s)? Será necessário fotografar os itens de cada
              pedido antes de confirmar a saída.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => beginShip(bulkConfirm)} data-testid="bulk-ship-confirm">
                Continuar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setBulkConfirm(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        <form className="mb-4 flex flex-wrap items-center gap-3" onSubmit={onShipAll}>
          <Button
            type="submit"
            disabled={!canShip || selected.size === 0 || !!activeShip}
            data-testid="bulk-ship-start"
          >
            Expedir selecionados ({selected.size})
          </Button>
          {items.length > 0 ? (
            <button type="button" className="text-sm text-blue-600 hover:underline" onClick={toggleAll}>
              {selected.size === items.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          ) : null}
        </form>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando fila…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum pedido aguardando expedição. Pedidos pagos ou confirmados aparecem aqui automaticamente.
          </p>
        ) : (
          <Table
            headers={["", "Pedido", "Origem", "Cliente", "Status", "Total", "Data", ""]}
            rows={items.map((o) => [
              <input
                key={`cb-${o.id}`}
                type="checkbox"
                checked={selected.has(o.id)}
                onChange={() => toggle(o.id)}
                aria-label={`Selecionar ${o.order_number}`}
              />,
              <span key={`n-${o.id}`} className="font-mono font-medium">
                {o.order_number}
              </span>,
              <span
                key={`ch-${o.id}`}
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${orderChannelBadgeClass(o.channel)}`}
              >
                {orderChannelLabel(o.channel)}
              </span>,
              o.customer_name,
              STATUS_LABEL[o.status] ?? o.status,
              `$${o.total_usd.toFixed(2)}`,
              new Date(o.created_at).toLocaleString("pt-BR"),
              <span key={`a-${o.id}`} className="flex gap-2">
                <Link href={`/pedidos/${o.id}`} className="text-sm text-blue-600 hover:underline">
                  Detalhes
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canShip || !!activeShip}
                  onClick={() => beginShip([o])}
                  data-testid={`ship-order-${o.order_number}`}
                >
                  Expedir
                </Button>
              </span>,
            ])}
          />
        )}
      </Card>

      {activeShip ? (
        <ShipExpeditionModal
          orderId={activeShip.id}
          orderNumber={activeShip.order_number}
          onClose={closeShipModal}
          onShipped={onShippedOne}
        />
      ) : null}
    </div>
  );
}
