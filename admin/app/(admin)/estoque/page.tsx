"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_LOCATION_ID, DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { Availability, InventoryUnit, SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

export default function EstoquePage() {
  const [skuCode, setSkuCode] = useState("000001");
  const [sku, setSku] = useState<SKU | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [receiveQty, setReceiveQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [receivedUnits, setReceivedUnits] = useState<InventoryUnit[]>([]);
  const [orderId, setOrderId] = useState("");
  const [reserveQty, setReserveQty] = useState("1");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookupSku() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const s = await api<SKU>(`/api/v1/pim/skus/code/${encodeURIComponent(skuCode)}`);
      setSku(s);
      const avail = await api<Availability>(
        `/api/v1/stock/availability?sku_id=${s.id}&warehouse_id=${DEFAULT_WAREHOUSE_ID}`,
      );
      setAvailability(avail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SKU não encontrado");
      setSku(null);
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  }

  async function onReceive(e: FormEvent) {
    e.preventDefault();
    if (!sku) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await api<{ units: InventoryUnit[] }>("/api/v1/stock/receive", {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: DEFAULT_WAREHOUSE_ID,
          items: [
            {
              sku_id: sku.id,
              quantity: parseInt(receiveQty, 10) || 1,
              unit_cost_usd: unitCost ? parseFloat(unitCost) : undefined,
            },
          ],
        }),
      });

      // Fluxo rápido: received → inspecting → identified → available
      for (const unit of res.units) {
        for (const status of ["inspecting", "identified"] as const) {
          await api(`/api/v1/stock/units/${unit.id}/transition`, {
            method: "POST",
            body: JSON.stringify({ status }),
          });
        }
        await api(`/api/v1/stock/units/${unit.id}/release`, {
          method: "POST",
          body: JSON.stringify({ location_id: DEFAULT_LOCATION_ID }),
        });
      }

      setReceivedUnits(res.units);
      setInfo(`${res.units.length} unidade(s) recebida(s) e disponibilizadas`);
      await lookupSku();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no recebimento");
    } finally {
      setLoading(false);
    }
  }

  async function onReserve(e: FormEvent) {
    e.preventDefault();
    if (!sku || !orderId) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const orderItemId = crypto.randomUUID();
      await api("/api/v1/stock/internal/reservations", {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          items: [
            {
              order_item_id: orderItemId,
              sku_id: sku.id,
              warehouse_id: DEFAULT_WAREHOUSE_ID,
              quantity: parseInt(reserveQty, 10) || 1,
            },
          ],
        }),
      });
      setInfo("Reserva criada com sucesso");
      await lookupSku();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na reserva");
    } finally {
      setLoading(false);
    }
  }

  async function releaseReservation() {
    if (!orderId) return;
    setError("");
    setInfo("");
    try {
      await api(`/api/v1/stock/internal/reservations/${orderId}`, { method: "DELETE" });
      setInfo("Reservas liberadas para o pedido");
      await lookupSku();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao liberar");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Estoque</h1>
        <p className="mt-1 text-sm text-slate-600">
          Consulta de disponibilidade, recebimento de unidades (AAA) e reservas por pedido.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Consultar SKU">
        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs font-mono"
            value={skuCode}
            onChange={(e) => setSkuCode(e.target.value)}
            placeholder="000001"
          />
          <Button type="button" onClick={() => void lookupSku()} disabled={loading}>
            Consultar
          </Button>
        </div>
        {availability && sku ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Físico" value={availability.qty_physical} />
            <Stat label="Reservado" value={availability.qty_reserved} />
            <Stat label="Disponível" value={availability.qty_available} />
          </div>
        ) : null}
      </Card>

      <Card title="Recebimento">
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={onReceive}>
          <Field label="Quantidade">
            <Input type="number" min={1} value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
          </Field>
          <Field label="Custo unit. USD">
            <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={!sku || loading}>
              Receber
            </Button>
          </div>
        </form>
        {receivedUnits.length ? (
          <div className="mt-4">
            <Table
              headers={["Código AAA", "SKU ID"]}
              rows={receivedUnits.map((u) => [u.unit_code, u.sku_id])}
            />
          </div>
        ) : null}
      </Card>

      <Card title="Reservas (pedido)">
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={onReserve}>
          <Field label="Order ID (UUID)" hint="ID do pedido para agrupar reservas">
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="uuid do pedido" />
          </Field>
          <Field label="Quantidade">
            <Input type="number" min={1} value={reserveQty} onChange={(e) => setReserveQty(e.target.value)} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={!sku || !orderId || loading}>
              Reservar
            </Button>
            <Button type="button" variant="secondary" onClick={() => void releaseReservation()} disabled={!orderId}>
              Liberar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-100 px-4 py-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
