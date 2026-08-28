"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, apiBlob, downloadBlob } from "@/lib/api";
import type { SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

type QueueItem = { sku: SKU; copies: number };

export default function EtiquetasPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SKU[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [format, setFormat] = useState<"pdf" | "html">("pdf");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setSearching(true);
    setError("");
    try {
      const res = await api<{ items: SKU[] }>(
        `/api/v1/pim/skus?active_only=true&limit=20&q=${encodeURIComponent(term)}`,
      );
      setHits(res.items ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na busca");
      setHits([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  function addSKU(s: SKU) {
    setQueue((prev) => {
      const i = prev.findIndex((x) => x.sku.id === s.id);
      if (i >= 0) {
        return prev.map((x, idx) => (idx === i ? { ...x, copies: x.copies + 1 } : x));
      }
      return [...prev, { sku: s, copies: 1 }];
    });
  }

  function setCopies(id: string, copies: number) {
    const n = Math.max(1, Math.min(50, Math.floor(copies) || 1));
    setQueue((prev) => prev.map((x) => (x.sku.id === id ? { ...x, copies: n } : x)));
  }

  function remove(id: string) {
    setQueue((prev) => prev.filter((x) => x.sku.id !== id));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!queue.length) {
      setError("Adicione ao menos um SKU para imprimir.");
      return;
    }
    setLoading(true);
    try {
      const items = queue.flatMap((row) =>
        Array.from({ length: row.copies }, () => ({ type: "cadastro", code: row.sku.code })),
      );
      const blob = await apiBlob("/api/v1/labels/batch", {
        method: "POST",
        body: JSON.stringify({ format, items }),
      });
      const ext = format === "html" ? "html" : "pdf";
      downloadBlob(blob, `etiquetas-gaveta.${ext}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar lote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Etiquetas de gaveta</h1>
        <p className="mt-1 text-sm text-slate-600">
          Impressão para identificar o produto na gaveta do estoque. Cada etiqueta traz só a{" "}
          <strong>descrição</strong>, o <strong>QR code</strong> e o <strong>SKU</strong> (registro no sistema).
        </p>
      </header>

      <Card title="Buscar produto">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código, nome ou descrição — ex. memória DDR4, R650, 000078"
        />
        {searching ? <p className="mt-3 text-sm text-slate-500">Buscando…</p> : null}
        {searched && !searching && hits.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum SKU encontrado para “{q.trim()}”.</p>
        ) : null}
        {hits.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {hits.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-slate-500">{s.code}</p>
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  {s.description ? (
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      {s.description.length > 120 ? `${s.description.slice(0, 120)}…` : s.description}
                    </p>
                  ) : null}
                </div>
                <Button type="button" variant="secondary" className="shrink-0" onClick={() => addSKU(s)}>
                  Adicionar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Fila de impressão">
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          {queue.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum SKU na fila. Busque e adicione os produtos das gavetas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.map((row) => (
                <li key={row.sku.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-slate-500">{row.sku.code}</p>
                    <p className="text-sm font-medium text-slate-900">{row.sku.name}</p>
                    {row.sku.description ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.sku.description.length > 90
                          ? `${row.sku.description.slice(0, 90)}…`
                          : row.sku.description}
                      </p>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Cópias
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      className="w-16"
                      value={row.copies}
                      onChange={(e) => setCopies(row.sku.id, parseInt(e.target.value, 10))}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => remove(row.sku.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Field label="Formato">
            <Select value={format} onChange={(e) => setFormat(e.target.value as "pdf" | "html")}>
              <option value="pdf">PDF (impressão)</option>
              <option value="html">HTML (visualizar)</option>
            </Select>
          </Field>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" disabled={loading || queue.length === 0}>
            {loading ? "Gerando…" : "Gerar etiquetas"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
