"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { pimApi } from "@/lib/api/pim";
import { pricingApi } from "@/lib/api/pricing";
import { useSkusList } from "@/hooks/use-pim-list-queries";
import { useSetSkuPrice } from "@/hooks/use-pricing-mutations";
import type { ResolvedPrice, SKU, SKUPrice } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

function usd(n?: number | null): string {
  return n != null && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function priceFromSku(s: SKU): SKUPrice {
  return {
    sku_id: s.id,
    cost_usd: s.cost_usd,
    min_price_usd: s.min_price_usd,
    price_b2c_usd: s.price_b2c_usd,
    price_b2b_usd: s.price_b2b_usd,
    price_reseller_usd: s.price_reseller_usd,
    updated_at: new Date().toISOString(),
  };
}

export default function PrecosPage() {
  const editRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: skusData, error: listError, loading: listing, refetch: refetchList } = useSkusList(searchTerm);
  const skus = skusData ?? [];
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
  const { run: saveSkuPrice, loading } = useSetSkuPrice();

  useEffect(() => {
    if (listError) setError(listError);
  }, [listError]);

  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(() => {
      setSearchTerm(term);
    }, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  function fillForm(p: SKUPrice) {
    setPrice(p);
    setCost(p.cost_usd != null ? String(p.cost_usd) : "");
    setMinPrice(p.min_price_usd != null ? String(p.min_price_usd) : "");
    setB2c(p.price_b2c_usd != null ? String(p.price_b2c_usd) : "");
    setB2b(p.price_b2b_usd != null ? String(p.price_b2b_usd) : "");
    setReseller(p.price_reseller_usd != null ? String(p.price_reseller_usd) : "");
  }

  async function loadPrices(s: SKU) {
    setSku(s);
    setInfo("");
    setError("");
    // Abre o formulário na hora (não depende da API).
    fillForm(priceFromSku(s));
    requestAnimationFrame(() => {
      editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const p = await pricingApi.getSkuPrice(s.id);
      fillForm(p);
      const channels = ["b2c", "b2b", "reseller"];
      const resolvedPrices = await Promise.all(
        channels.map((ch) => pricingApi.resolve(s.id, ch).catch(() => null)),
      );
      setResolved(resolvedPrices.filter((r): r is ResolvedPrice => Boolean(r)));
    } catch (err) {
      setResolved([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar preços da API — editando com valores da lista.");
    }
  }

  function closeEditor() {
    setSku(null);
    setPrice(null);
    setResolved([]);
    setInfo("");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!sku) return;
    setError("");
    setInfo("");
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

      if (Object.keys(body).length === 0) {
        setError("Informe ao menos um preço para salvar.");
        return;
      }

      await saveSkuPrice({ skuId: sku.id, body });
      setInfo("Preços atualizados");
      await refetchList();
      const updated = { ...sku, ...body };
      setSku(updated);
      await loadPrices(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Preços</h1>
        <p className="mt-1 text-sm text-slate-600">
          Clique em <strong>Editar</strong> (ou na linha) para alterar custo, B2C, B2B e revenda.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      {sku && price ? (
        <div ref={editRef}>
          <Card title={`Editando — ${sku.code} · ${sku.name}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              {sku.description ? <p className="text-sm text-slate-600">{sku.description}</p> : <span />}
              <div className="flex gap-3 text-sm">
                {sku.product_id ? (
                  <Link href={`/produtos/${sku.product_id}`} className="text-blue-600 hover:underline">
                    Abrir produto
                  </Link>
                ) : null}
                <button type="button" className="text-slate-600 hover:underline" onClick={closeEditor}>
                  Fechar
                </button>
              </div>
            </div>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSave(e)}>
              <Field label="Custo USD">
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} autoFocus />
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
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando…" : "Salvar preços"}
                </Button>
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>

          {resolved.length > 0 ? (
            <div className="mt-4">
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
            </div>
          ) : null}
        </div>
      ) : null}

      <Card title={`Produtos (${skus.length})`}>
        <div className="mb-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por código, nome ou descrição…"
          />
        </div>

        {listing ? (
          <p className="text-sm text-slate-500">Carregando produtos…</p>
        ) : skus.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum produto encontrado.</p>
        ) : (
          <Table
            onRowClick={(index) => void loadPrices(skus[index])}
            headers={["Código", "Produto", "Custo", "B2C", "B2B", "Revenda", ""]}
            rows={skus.map((s) => {
              const selected = sku?.id === s.id;
              return [
                <span
                  key="c"
                  className={`font-mono font-medium ${selected ? "text-blue-800" : "text-blue-700"}`}
                >
                  {s.code}
                </span>,
                <div key="n">
                  <p className={`font-medium ${selected ? "text-blue-900" : "text-slate-900"}`}>{s.name}</p>
                  {s.description ? (
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      {s.description.length > 90 ? `${s.description.slice(0, 90)}…` : s.description}
                    </p>
                  ) : null}
                </div>,
                <span key="cost" className="font-mono tabular-nums">
                  {usd(s.cost_usd)}
                </span>,
                <span key="b2c" className="font-mono tabular-nums">
                  {usd(s.price_b2c_usd)}
                </span>,
                <span key="b2b" className="font-mono tabular-nums">
                  {usd(s.price_b2b_usd)}
                </span>,
                <span key="res" className="font-mono tabular-nums">
                  {usd(s.price_reseller_usd)}
                </span>,
                <span key="a" className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`text-sm font-medium ${
                      selected ? "text-emerald-700" : "text-blue-600 hover:underline"
                    }`}
                    onClick={() => void loadPrices(s)}
                  >
                    {selected ? "Editando…" : "Editar"}
                  </button>
                </span>,
              ];
            })}
          />
        )}
      </Card>
    </div>
  );
}
