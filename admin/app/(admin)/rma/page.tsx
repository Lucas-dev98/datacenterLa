"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Order, OrderItem, OrderListItem } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

type RMACase = {
  id: string;
  case_number: string;
  order_number?: string;
  customer_name?: string;
  status: string;
  reason: string;
  created_at: string;
};

export default function RMAPage() {
  const [items, setItems] = useState<RMACase[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [resolveResolution, setResolveResolution] = useState("restock");
  const [loadingOrder, setLoadingOrder] = useState(false);

  async function load() {
    try {
      const res = await api<{ items: RMACase[] }>("/api/v1/sales/rma");
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  async function loadShippedOrders() {
    try {
      const res = await api<{ items: OrderListItem[] }>("/api/v1/sales/orders?status=shipped&limit=100");
      setOrders(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    }
  }

  useEffect(() => {
    void load();
    void loadShippedOrders();
  }, []);

  useEffect(() => {
    if (!orderId) {
      setOrderItems([]);
      setOrderItemId("");
      return;
    }
    void (async () => {
      setLoadingOrder(true);
      setError("");
      try {
        const order = await api<Order>(`/api/v1/sales/orders/${orderId}`);
        const lines = order.items ?? [];
        setOrderItems(lines);
        setOrderItemId(lines[0]?.id ?? "");
        setQuantity(1);
      } catch (err) {
        setOrderItems([]);
        setOrderItemId("");
        setError(err instanceof Error ? err.message : "Erro ao carregar itens do pedido");
      } finally {
        setLoadingOrder(false);
      }
    })();
  }, [orderId]);

  const selectedLine = orderItems.find((l) => l.id === orderItemId);

  async function createRMA(e: FormEvent) {
    e.preventDefault();
    setInfo("");
    setError("");
    if (!selectedLine) {
      setError("Selecione um item do pedido");
      return;
    }
    try {
      await api("/api/v1/sales/rma", {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          reason,
          items: [{
            order_item_id: selectedLine.id,
            sku_id: selectedLine.sku_id,
            quantity,
          }],
        }),
      });
      setInfo("RMA aberto");
      setOrderId("");
      setOrderItemId("");
      setReason("");
      setQuantity(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir RMA");
    }
  }

  async function action(id: string, step: "approve" | "receive" | "resolve") {
    setError("");
    try {
      await api(`/api/v1/sales/rma/${id}/${step}`, {
        method: "POST",
        body: step === "resolve" ? JSON.stringify({ resolution: resolveResolution }) : undefined,
      });
      setInfo(`RMA ${step}${step === "resolve" ? ` (${resolveResolution})` : ""}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na ação");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Devoluções / RMA</h1>
        <p className="mt-1 text-sm text-slate-600">Somente pedidos expedidos · solicitação → aprovação → recebimento → resolução</p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Abrir RMA">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={createRMA}>
          <Field label="Pedido expedido" hint="Apenas status shipped">
            <Select value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
              <option value="">Selecione…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.customer_name} (${o.total_usd.toFixed(2)})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Item do pedido">
            <Select
              value={orderItemId}
              onChange={(e) => {
                setOrderItemId(e.target.value);
                const line = orderItems.find((l) => l.id === e.target.value);
                setQuantity(line ? Math.min(quantity, line.quantity) || 1 : 1);
              }}
              required
              disabled={!orderId || loadingOrder || orderItems.length === 0}
            >
              {loadingOrder ? <option value="">Carregando…</option> : null}
              {!loadingOrder && orderItems.length === 0 ? <option value="">Sem itens</option> : null}
              {orderItems.map((line) => (
                <option key={line.id} value={line.id}>
                  {(line.sku_code ?? line.sku_id.slice(0, 8))} · qtd {line.quantity} · ${line.line_total_usd.toFixed(2)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantidade">
            <Input
              type="number"
              min={1}
              max={selectedLine?.quantity ?? 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              disabled={!selectedLine}
            />
          </Field>
          <Field label="Motivo">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={!orderId || !orderItemId}>Abrir caso</Button>
          </div>
        </form>
        {orders.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nenhum pedido expedido disponível para devolução.</p>
        ) : null}
      </Card>

      <Card title="Casos RMA">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Resolução padrão">
            <Select value={resolveResolution} onChange={(e) => setResolveResolution(e.target.value)}>
              <option value="restock">Restock — volta ao estoque</option>
              <option value="refund">Reembolso — estorno financeiro</option>
              <option value="warranty">Garantia</option>
              <option value="replace">Substituição (restock)</option>
              <option value="reject">Rejeitar — avariado</option>
            </Select>
          </Field>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum caso.</p>
        ) : (
          <Table
            headers={["Caso", "Pedido", "Cliente", "Status", "Motivo", ""]}
            rows={items.map((r) => [
              r.case_number,
              r.order_number ?? "—",
              r.customer_name ?? "—",
              r.status,
              r.reason,
              <div key="a" className="flex flex-wrap gap-2">
                {r.status === "requested" ? (
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void action(r.id, "approve")}>Aprovar</button>
                ) : null}
                {r.status === "approved" ? (
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void action(r.id, "receive")}>Receber</button>
                ) : null}
                {r.status === "received" ? (
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void action(r.id, "resolve")}>Resolver</button>
                ) : null}
              </div>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
