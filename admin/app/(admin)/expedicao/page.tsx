"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { orderChannelBadgeClass, orderChannelLabel } from "@/lib/order-channels";
import type { OrderListItem } from "@/lib/types";
import { Alert, Button, Card, Table } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado — aguardando separação",
  paid: "Pago — aguardando separação",
  picking: "Em separação",
};

const QUEUE_STATUSES = ["confirmed", "paid", "picking"] as const;

export default function ExpedicaoPage() {
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const batches = await Promise.all(
        QUEUE_STATUSES.map((status) =>
          api<{ items: OrderListItem[] }>(`/api/v1/sales/orders?limit=100&status=${status}`),
        ),
      );
      const merged = batches.flatMap((b) => b.items ?? []);
      const byId = new Map<string, OrderListItem>();
      for (const o of merged) byId.set(o.id, o);
      const list = [...byId.values()];
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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

  async function ship(orderIds: string[]) {
    if (orderIds.length === 0) return;
    setError("");
    setInfo("");
    setSubmitting(true);
    const failed: string[] = [];
    let ok = 0;
    try {
      for (const id of orderIds) {
        try {
          await api(`/api/v1/sales/orders/${id}/ship`, { method: "POST" });
          ok++;
        } catch {
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        setError(`${failed.length} pedido(s) não expedidos`);
      }
      if (ok > 0) {
        setInfo(`${ok} pedido(s) expedido(s) — estoque baixado`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao expedir");
    } finally {
      setSubmitting(false);
    }
  }

  async function onShipAll(e: FormEvent) {
    e.preventDefault();
    if (!confirm(`Expedir ${selected.size} pedido(s) selecionado(s)?`)) return;
    await ship([...selected]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Expedição</p>
          <h1 className="text-2xl font-semibold text-slate-900">Fila de expedição</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pedidos confirmados ou pagos aguardando separação — e-commerce, loja física e ERP em uma
            única fila.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card>
        <form className="mb-4 flex flex-wrap items-center gap-3" onSubmit={onShipAll}>
          <Button type="submit" disabled={selected.size === 0 || submitting}>
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
            Nenhum pedido aguardando expedição. Pedidos pagos ou confirmados aparecem aqui
            automaticamente.
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
                  disabled={submitting}
                  onClick={() => void ship([o.id])}
                >
                  Expedir
                </Button>
              </span>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
