"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { receiveIntakeWithPhotos, api } from "@/lib/api";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { InventoryUnitReceive, SKU } from "@/lib/types";
import { BatchPhotoUploader, type BatchPhotoDraft } from "@/components/intake-batch-photos";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

async function searchSkus(term: string): Promise<SKU[]> {
  const q = term.trim();
  if (!q) return [];

  const byCode = await api<SKU>(`/api/v1/pim/skus/code/${encodeURIComponent(q)}`).catch(() => null);
  if (byCode?.is_active) return [byCode];

  const res = await api<{ items: SKU[] }>(
    `/api/v1/pim/skus?q=${encodeURIComponent(q)}&active_only=true&limit=20`,
  );
  return res.items ?? [];
}

export default function EntradaAvulsaPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SKU[]>([]);
  const [searching, setSearching] = useState(false);
  const [sku, setSku] = useState<SKU | null>(null);
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [nextCodes, setNextCodes] = useState<string[]>([]);
  const [batchPhotos, setBatchPhotos] = useState<BatchPhotoDraft[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<InventoryUnitReceive[]>([]);

  const quantity = Math.max(1, Math.min(100, parseInt(qty, 10) || 1));

  const loadNextCodes = useCallback(async (count: number) => {
    setCodesLoading(true);
    try {
      const res = await api<{ codes: string[] }>(`/api/v1/stock/units/next-codes?count=${count}`);
      setNextCodes(res.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reservar códigos AAA");
    } finally {
      setCodesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sku) {
      setNextCodes([]);
      return;
    }
    void loadNextCodes(quantity);
  }, [sku, quantity, loadNextCodes]);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const items = await searchSkus(term);
      setSearchResults(items);
      if (items.length === 0) {
        setError("Nenhum SKU encontrado — tente código, nome ou descrição do produto.");
      }
    } catch (err) {
      setSearchResults([]);
      setError(err instanceof Error ? err.message : "Erro na busca");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => void runSearch(term), 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  function selectSku(s: SKU) {
    setSku(s);
    setError("");
  }

  async function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    await runSearch(searchQuery);
  }

  const ready = useMemo(
    () => Boolean(sku) && nextCodes.length === quantity && batchPhotos.length > 0,
    [sku, nextCodes.length, quantity, batchPhotos.length],
  );

  const codeRange =
    nextCodes.length > 1
      ? `${nextCodes[0]} … ${nextCodes[nextCodes.length - 1]}`
      : nextCodes[0] ?? "";

  async function onReceive(e: FormEvent) {
    e.preventDefault();
    if (!sku || !ready) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const payload = {
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        items: [
          {
            sku_id: sku.id,
            quantity,
            unit_cost_usd: unitCost ? parseFloat(unitCost) : undefined,
          },
        ],
      };
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      batchPhotos.forEach((photo, index) => {
        form.append(`batch_photo_${index}`, photo.file);
      });
      const res = await receiveIntakeWithPhotos(form);
      setUnits(res.units ?? []);
      setInfo(
        `${res.units?.length ?? 0} unidade(s) registrada(s) com ${batchPhotos.length} foto(s) do lote. Prossiga na fila de recebimento.`,
      );
      batchPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
      setBatchPhotos([]);
      setNextCodes([]);
      setSku(null);
      setSearchQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no recebimento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/estoque/entrada" className="hover:underline">
            Entrada
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Entrada avulsa</h1>
        <p className="mt-1 text-sm text-slate-600">
          Informe a quantidade, confira os códigos AAA que serão gerados e anexe algumas fotos do lote inteiro — não
          precisa fotografar unidade por unidade.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="1. Identificar item">
        <form className="flex flex-wrap gap-3" onSubmit={onSearchSubmit}>
          <div className="min-w-[240px] flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (sku && e.target.value.trim() !== sku.code && e.target.value.trim() !== sku.name) {
                  setSku(null);
                }
              }}
              placeholder="Código, nome ou descrição — ex: Samsung 32GB DDR4"
              autoFocus
            />
          </div>
          <Button type="submit" variant="secondary" disabled={searching || !searchQuery.trim()}>
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </form>

        {searchResults.length > 0 ? (
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {searchResults.map((s) => {
              const selected = sku?.id === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectSku(s)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selected ? "bg-blue-50 ring-2 ring-blue-500" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-mono font-semibold text-slate-900">{s.code}</span>
                    <span className="mt-0.5 block font-medium text-slate-800">{s.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {sku ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">Selecionado:</p>
            <p className="mt-1">
              <span className="font-mono font-semibold">{sku.code}</span> — {sku.name}
            </p>
          </div>
        ) : null}
      </Card>

      {sku ? (
        <Card title="2. Lote — códigos AAA e fotos">
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Field label="Quantidade">
              <Input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Custo unit. USD (opcional)">
              <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                disabled={codesLoading}
                onClick={() => void loadNextCodes(quantity)}
              >
                Atualizar códigos
              </Button>
            </div>
          </div>

          {codesLoading ? (
            <p className="mb-4 text-sm text-slate-500">Carregando códigos…</p>
          ) : nextCodes.length > 0 ? (
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium text-slate-800">
                {quantity} unidade(s) — intervalo{" "}
                <span className="font-mono text-blue-700">{codeRange}</span>
              </p>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                {nextCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-md bg-slate-900 px-2 py-1 font-mono text-xs font-medium text-white"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <BatchPhotoUploader photos={batchPhotos} variant="intake" onChange={setBatchPhotos} />

          <form className="mt-6 flex justify-end" onSubmit={onReceive}>
            <Button type="submit" disabled={!ready || loading || codesLoading}>
              Registrar entrada ({quantity} un.)
            </Button>
          </form>
          {!ready && nextCodes.length > 0 ? (
            <p className="mt-2 text-right text-xs text-slate-500">
              Adicione pelo menos uma foto mostrando as unidades do lote.
            </p>
          ) : null}
        </Card>
      ) : null}

      {units.length > 0 ? (
        <Card title="3. Unidades criadas">
          <p className="mb-2 text-sm text-slate-600">
            {units.length} códigos gerados:{" "}
            <span className="font-mono">
              {units[0]?.unit_code}
              {units.length > 1 ? ` … ${units[units.length - 1]?.unit_code}` : ""}
            </span>
          </p>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => router.push("/estoque/entrada/recebimento")}>
              Ir para fila de recebimento / liberação
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
