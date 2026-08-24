"use client";

import { FormEvent, useState } from "react";
import { apiBlob, downloadBlob } from "@/lib/api";
import { Alert, Button, Card, Field, Select, Textarea } from "@/components/ui";

type BatchItem = { type: string; code: string };

export default function EtiquetasPage() {
  const [format, setFormat] = useState<"pdf" | "html">("pdf");
  const [text, setText] = useState("000001 cadastro\nAAA0001 unit");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function parseLines(raw: string): BatchItem[] {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/);
        const code = parts[0];
        const type = (parts[1] ?? "cadastro").toLowerCase();
        return { type: type === "unit" ? "unit" : "cadastro", code };
      });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const items = parseLines(text);
      if (!items.length) {
        setError("Informe ao menos uma linha: CODIGO [cadastro|unit]");
        return;
      }
      const blob = await apiBlob("/api/v1/labels/batch", {
        method: "POST",
        body: JSON.stringify({ format, items }),
      });
      const ext = format === "html" ? "html" : "pdf";
      downloadBlob(blob, `etiquetas-lote.${ext}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar lote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Etiquetas em lote</h1>
        <p className="mt-1 text-sm text-slate-600">
          Uma linha por etiqueta: <code className="rounded bg-slate-100 px-1">CODIGO cadastro</code> ou{" "}
          <code className="rounded bg-slate-100 px-1">CODIGO unit</code>
        </p>
      </header>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Formato">
            <Select value={format} onChange={(e) => setFormat(e.target.value as "pdf" | "html")}>
              <option value="pdf">PDF (impressão)</option>
              <option value="html">HTML (visualizar)</option>
            </Select>
          </Field>
          <Field label="Itens" hint="Ex: 000001 cadastro · AAA0001 unit">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
          </Field>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Gerando…" : "Gerar e baixar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
