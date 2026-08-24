"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

type StockCount = {
  id: string;
  warehouse_id: string;
  status: string;
  count_type: string;
  created_at: string;
  lines?: { sku_code?: string; system_qty: number; counted_qty?: number; variance: number }[];
};

type Adjustment = {
  id: string;
  sku_code?: string;
  quantity_delta: number;
  reason: string;
  status: string;
};

export default function InventarioPage() {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null);
  const [skuId, setSkuId] = useState("");
  const [countedQty, setCountedQty] = useState("0");
  const [adjSku, setAdjSku] = useState("");
  const [adjDelta, setAdjDelta] = useState("-1");
  const [adjReason, setAdjReason] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function load() {
    setError("");
    try {
      const [c, a] = await Promise.all([
        api<{ items: StockCount[] }>("/api/v1/stock/counts"),
        api<{ items: Adjustment[] }>("/api/v1/stock/adjustments"),
      ]);
      setCounts(c.items ?? []);
      setAdjustments(a.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCount() {
    try {
      const c = await api<StockCount>("/api/v1/stock/counts", {
        method: "POST",
        body: JSON.stringify({ warehouse_id: DEFAULT_WAREHOUSE_ID, count_type: "full" }),
      });
      setSelectedCount(c);
      setInfo("Sessão de inventário criada");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function startCount(id: string) {
    await api(`/api/v1/stock/counts/${id}/start`, { method: "POST" });
    const c = await api<StockCount>(`/api/v1/stock/counts/${id}`);
    setSelectedCount(c);
    setInfo("Contagem iniciada");
  }

  async function addLine(e: FormEvent) {
    e.preventDefault();
    if (!selectedCount) return;
    const c = await api<StockCount>(`/api/v1/stock/counts/${selectedCount.id}/lines`, {
      method: "POST",
      body: JSON.stringify({ sku_id: skuId, counted_qty: parseInt(countedQty, 10) || 0 }),
    });
    setSelectedCount(c);
    setInfo("Linha registrada");
  }

  async function completeCount() {
    if (!selectedCount) return;
    await api(`/api/v1/stock/counts/${selectedCount.id}/complete`, { method: "POST" });
    const c = await api<StockCount>(`/api/v1/stock/counts/${selectedCount.id}`);
    setSelectedCount(c);
    setInfo("Contagem finalizada — aguardando aprovação");
    await load();
  }

  async function approveCount() {
    if (!selectedCount) return;
    const c = await api<StockCount>(`/api/v1/stock/counts/${selectedCount.id}/approve`, { method: "POST" });
    setSelectedCount(c);
    setInfo("Inventário aprovado — ajustes gerados");
    await load();
  }

  async function createAdjustment(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/stock/adjustments", {
      method: "POST",
      body: JSON.stringify({
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        sku_id: adjSku,
        quantity_delta: parseInt(adjDelta, 10) || 0,
        reason: adjReason,
      }),
    });
    setInfo("Ajuste solicitado");
    await load();
  }

  async function approveAdj(id: string) {
    await api(`/api/v1/stock/adjustments/${id}/approve`, { method: "POST" });
    await load();
  }

  async function applyAdj(id: string) {
    await api(`/api/v1/stock/adjustments/${id}/apply`, { method: "POST" });
    setInfo("Ajuste aplicado no estoque");
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Inventário e ajustes</h1>
        <p className="mt-1 text-sm text-slate-600">Contagem física com aprovação e ajustes auditados</p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Inventário">
        <div className="mb-4 flex gap-2">
          <Button type="button" onClick={() => void createCount()}>Nova contagem</Button>
          {selectedCount ? (
            <>
              {selectedCount.status === "draft" ? (
                <Button type="button" variant="secondary" onClick={() => void startCount(selectedCount.id)}>Iniciar</Button>
              ) : null}
              {selectedCount.status === "in_progress" ? (
                <Button type="button" variant="secondary" onClick={() => void completeCount()}>Finalizar</Button>
              ) : null}
              {selectedCount.status === "pending_review" ? (
                <Button type="button" onClick={() => void approveCount()}>Aprovar</Button>
              ) : null}
            </>
          ) : null}
        </div>
        {selectedCount ? (
          <p className="mb-4 text-sm text-slate-600">
            Sessão <span className="font-mono">{selectedCount.id.slice(0, 8)}…</span> · status: <strong>{selectedCount.status}</strong>
          </p>
        ) : null}
        {selectedCount?.status === "in_progress" ? (
          <form className="mb-4 grid gap-3 sm:grid-cols-3" onSubmit={addLine}>
            <Field label="SKU ID (UUID)">
              <Input value={skuId} onChange={(e) => setSkuId(e.target.value)} required />
            </Field>
            <Field label="Qtd contada">
              <Input type="number" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Registrar linha</Button>
            </div>
          </form>
        ) : null}
        {selectedCount?.lines?.length ? (
          <Table
            headers={["SKU", "Sistema", "Contado", "Variância"]}
            rows={selectedCount.lines.map((l) => [
              l.sku_code ?? "—",
              l.system_qty,
              l.counted_qty ?? "—",
              l.variance,
            ])}
          />
        ) : null}
        <div className="mt-4">
          <Table
            headers={["ID", "Status", "Tipo", "Criado"]}
            rows={counts.map((c) => [
              c.id.slice(0, 8) + "…",
              c.status,
              c.count_type,
              new Date(c.created_at).toLocaleString("pt-BR"),
            ])}
          />
        </div>
      </Card>

      <Card title="Ajustes manuais">
        <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={createAdjustment}>
          <Field label="SKU ID">
            <Input value={adjSku} onChange={(e) => setAdjSku(e.target.value)} required />
          </Field>
          <Field label="Delta (+/-)">
            <Input type="number" value={adjDelta} onChange={(e) => setAdjDelta(e.target.value)} required />
          </Field>
          <Field label="Motivo" hint="Obrigatório para auditoria">
            <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} required />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Solicitar ajuste</Button>
          </div>
        </form>
        <Table
          headers={["SKU", "Delta", "Status", "Motivo", ""]}
          rows={adjustments.map((a) => [
            a.sku_code ?? "—",
            a.quantity_delta,
            a.status,
            a.reason,
            <div key="a" className="flex gap-2">
              {a.status === "pending" ? (
                <button type="button" className="text-blue-600 hover:underline" onClick={() => void approveAdj(a.id)}>Aprovar</button>
              ) : null}
              {a.status === "approved" ? (
                <button type="button" className="text-blue-600 hover:underline" onClick={() => void applyAdj(a.id)}>Aplicar</button>
              ) : null}
            </div>,
          ])}
        />
      </Card>
    </div>
  );
}
