"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ResolvedPrice, SKU, SKUPrice } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

export default function PrecosPage() {
  const [skuCode, setSkuCode] = useState("000001");
  const [sku, setSku] = useState<SKU | null>(null);
  const [price, setPrice] = useState<SKUPrice | null>(null);
  const [resolved, setResolved] = useState<ResolvedPrice[]>([]);
  const [cost, setCost] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [b2c, setB2c] = useState("");
  const [b2b, setB2b] = useState("");
  const [reseller, setReseller] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPrices(s: SKU) {
    const p = await api<SKUPrice>(`/api/v1/pricing/skus/${s.id}`);
    setPrice(p);
    setCost(p.cost_usd?.toString() ?? "");
    setMinPrice(p.min_price_usd?.toString() ?? "");
    setB2c(p.price_b2c_usd?.toString() ?? "");
    setB2b(p.price_b2b_usd?.toString() ?? "");
    setReseller(p.price_reseller_usd?.toString() ?? "");

    const channels = ["b2c", "b2b", "reseller"];
    const resolvedPrices = await Promise.all(
      channels.map((ch) => api<ResolvedPrice>(`/api/v1/pricing/skus/${s.id}/resolve?channel=${ch}`)),
    );
    setResolved(resolvedPrices);
  }

  async function lookup() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const s = await api<SKU>(`/api/v1/pim/skus/code/${encodeURIComponent(skuCode)}`);
      setSku(s);
      await loadPrices(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SKU não encontrado");
      setSku(null);
      setPrice(null);
      setResolved([]);
    } finally {
      setLoading(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!sku) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const body: Record<string, number> = {};
      if (cost) body.cost_usd = parseFloat(cost);
      if (minPrice) body.min_price_usd = parseFloat(minPrice);
      if (b2c) body.price_b2c_usd = parseFloat(b2c);
      if (b2b) body.price_b2b_usd = parseFloat(b2b);
      if (reseller) body.price_reseller_usd = parseFloat(reseller);

      await api(`/api/v1/pricing/skus/${sku.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setInfo("Preços atualizados");
      await loadPrices(sku);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Preços</h1>
        <p className="mt-1 text-sm text-slate-600">Consulta e alteração de preços por SKU.</p>
      </header>

      <Card title="Buscar SKU">
        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs font-mono"
            value={skuCode}
            onChange={(e) => setSkuCode(e.target.value)}
            placeholder="000001"
          />
          <Button type="button" onClick={() => void lookup()} disabled={loading}>
            Consultar
          </Button>
          {sku?.product_id ? (
            <Link href={`/produtos/${sku.product_id}`} className="self-center text-sm text-blue-600 hover:underline">
              Editar produto
            </Link>
          ) : null}
        </div>
      </Card>

      {sku && price ? (
        <>
          <Card title={`Preços — ${sku.code}`}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
              <Field label="Custo USD">
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </Field>
              <Field label="Preço mínimo USD">
                <Input type="number" step="0.01" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </Field>
              <Field label="B2C USD">
                <Input type="number" step="0.01" value={b2c} onChange={(e) => setB2c(e.target.value)} />
              </Field>
              <Field label="B2B USD">
                <Input type="number" step="0.01" value={b2b} onChange={(e) => setB2b(e.target.value)} />
              </Field>
              <Field label="Revendedor USD">
                <Input type="number" step="0.01" value={reseller} onChange={(e) => setReseller(e.target.value)} />
              </Field>
              <div className="flex items-end sm:col-span-2">
                <Button type="submit" disabled={loading}>
                  Salvar preços
                </Button>
              </div>
            </form>
          </Card>

          {resolved.length ? (
            <Card title="Preço resolvido por canal (com IVA 10%)">
              <Table
                headers={["Canal", "Base USD", "Com IVA USD", "Promo"]}
                rows={resolved.map((r) => [
                  r.channel,
                  `$${r.base_price_usd.toFixed(2)}`,
                  `$${r.price_with_iva_usd.toFixed(2)}`,
                  r.promo_applied ? "Sim" : "Não",
                ])}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}
    </div>
  );
}
