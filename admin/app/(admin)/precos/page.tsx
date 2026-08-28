"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ResolvedPrice, SKU, SKUPrice } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

function usd(n?: number | null): string {
  return n != null && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

export default function PrecosPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SKU[]>([]);
  const [searched, setSearched] = useState(false);
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
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(() => {
      void search(term);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  async function search(term: string) {
    setError("");
    setSearching(true);
    try {
      const res = await api<{ items: SKU[] }>(
        `/api/v1/pim/skus?active_only=true&limit=25&q=${encodeURIComponent(term)}`,
      );
      const items = res.items ?? [];
      setHits(items);
      setSearched(true);
      if (items.length === 1) {
        await loadPrices(items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na busca");
      setHits([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function loadPrices(s: SKU) {
    setSku(s);
    setInfo("");
    setError("");
    try {
      const p = await api<SKUPrice>(`/api/v1/pricing/skus/${s.id}`);
      setPrice(p);
      setCost(p.cost_usd?.toString() ?? "");
      setMinPrice(p.min_price_usd?.toString() ?? "");
      setB2c(p.price_b2c_usd?.toString() ?? "");
      setB2b(p.price_b2b_usd?.toString() ?? "");
      setReseller(p.price_reseller_usd?.toString() ?? "");
      const channels = ["b2c", "b2b", "reseller"];
      const resolvedPrices = await Promise.all(
        channels.map((ch) => api<ResolvedPrice>(`/api/v1/pricing/skus/${s.id}/resolve?channel=${ch}`).catch(() => null)),
      );
      setResolved(resolvedPrices.filter((r): r is ResolvedPrice => Boolean(r)));
    } catch {
      setPrice({
        sku_id: s.id,
        cost_usd: s.cost_usd,
        min_price_usd: s.min_price_usd,
        price_b2c_usd: s.price_b2c_usd,
        price_b2b_usd: s.price_b2b_usd,
        price_reseller_usd: s.price_reseller_usd,
        updated_at: new Date().toISOString(),
      });
      setCost(s.cost_usd?.toString() ?? "");
      setMinPrice(s.min_price_usd?.toString() ?? "");
      setB2c(s.price_b2c_usd?.toString() ?? "");
      setB2b(s.price_b2b_usd?.toString() ?? "");
      setReseller(s.price_reseller_usd?.toString() ?? "");
      setResolved([]);
    }
  }

  async function onConsult(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) {
      setError("Digite pelo menos 2 caracteres (código, nome ou descrição).");
      return;
    }
    await search(term);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!sku) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const body: Record<string, number> = {};
      const costN = parseFloat(cost);
      const minN = parseFloat(minPrice);
      const b2cN = parseFloat(b2c);
      const b2bN = parseFloat(b2b);
      const resellerN = parseFloat(reseller);
      if (Number.isFinite(costN)) body.cost_usd = costN;
      if (Number.isFinite(minN)) body.min_price_usd = minN;
      if (Number.isFinite(b2cN)) body.price_b2c_usd = b2cN;
      if (Number.isFinite(b2bN)) body.price_b2b_usd = b2bN;
      if (Number.isFinite(resellerN)) body.price_reseller_usd = resellerN;

      await api(`/api/v1/pricing/skus/${sku.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setInfo("Preços atualizados");
      await loadPrices(sku);
      setHits((prev) =>
        prev.map((h) =>
          h.id === sku.id
            ? {
                ...h,
                cost_usd: body.cost_usd ?? h.cost_usd,
                min_price_usd: body.min_price_usd ?? h.min_price_usd,
                price_b2c_usd: body.price_b2c_usd ?? h.price_b2c_usd,
                price_b2b_usd: body.price_b2b_usd ?? h.price_b2b_usd,
                price_reseller_usd: body.price_reseller_usd ?? h.price_reseller_usd,
              }
            : h,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Preços</h1>
        <p className="mt-1 text-sm text-slate-600">
          Busque por código, nome ou descrição e altere os preços do SKU.
        </p>
      </header>

      <Card title="Buscar SKU">
        <form className="flex flex-wrap gap-3" onSubmit={(e) => void onConsult(e)}>
          <Input
            className="max-w-lg"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Código, nome ou descrição — ex. memória DDR4, R650, 000001"
          />
          <Button type="submit" disabled={searching}>
            {searching ? "Buscando…" : "Consultar"}
          </Button>
          {sku?.product_id ? (
            <Link href={`/produtos/${sku.product_id}`} className="self-center text-sm text-blue-600 hover:underline">
              Editar produto
            </Link>
          ) : null}
        </form>

        {searched && !searching && hits.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum SKU encontrado para “{q.trim()}”.</p>
        ) : null}

        {hits.length > 0 ? (
          <div className="mt-4">
            <Table
              headers={["Código", "SKU", "Custo", "B2C", "B2B", ""]}
              rows={hits.map((s) => [
                <span key="c" className="font-mono font-medium">{s.code}</span>,
                <div key="n">
                  <p className="font-medium text-slate-900">{s.name}</p>
                  {s.description ? (
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      {s.description.length > 110 ? `${s.description.slice(0, 110)}…` : s.description}
                    </p>
                  ) : null}
                </div>,
                <span key="cost" className="font-mono tabular-nums">{usd(s.cost_usd)}</span>,
                <span key="b2c" className="font-mono tabular-nums">{usd(s.price_b2c_usd)}</span>,
                <span key="b2b" className="font-mono tabular-nums">{usd(s.price_b2b_usd)}</span>,
                <button
                  key="sel"
                  type="button"
                  className={`text-sm font-medium ${sku?.id === s.id ? "text-slate-400" : "text-blue-600 hover:underline"}`}
                  onClick={() => void loadPrices(s)}
                  disabled={sku?.id === s.id}
                >
                  {sku?.id === s.id ? "Selecionado" : "Selecionar"}
                </button>,
              ])}
            />
          </div>
        ) : null}
      </Card>

      {sku && price ? (
        <>
          <Card title={`Preços — ${sku.code} · ${sku.name}`}>
            {sku.description ? <p className="mb-4 text-sm text-slate-600">{sku.description}</p> : null}
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
