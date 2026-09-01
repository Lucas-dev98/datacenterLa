"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { QrScanner } from "@/components/qr-scanner";
import {
  useAddStockCountLine,
  useApplyStockAdjustment,
  useApproveStockAdjustment,
  useApproveStockCount,
  useCompleteStockCount,
  useCreateStockAdjustment,
  useCreateStockCount,
  useStartStockCount,
} from "@/hooks/use-stock-count-mutations";
import { stockApi, type StockAdjustment, type StockCount } from "@/lib/api/stock";
import { pimApi } from "@/lib/api/pim";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { parseQrPayload } from "@/lib/qr-decode";
import { playScanBeep, unlockScanAudio } from "@/lib/scan-beep";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

type ResolvedItem = {
  kind: "unit" | "sku";
  code: string;
  skuId: string;
  skuCode: string;
  label: string;
};

export default function InventarioPage() {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [skuQty, setSkuQty] = useState("1");
  const [autoIncrement, setAutoIncrement] = useState(true);
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);
  const [pendingSkuCounts, setPendingSkuCounts] = useState<Record<string, number>>({});
  const [adjSku, setAdjSku] = useState("");
  const [adjDelta, setAdjDelta] = useState("-1");
  const [adjReason, setAdjReason] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const { run: createCount, loading: creating } = useCreateStockCount();
  const { run: startCount, loading: starting } = useStartStockCount();
  const { run: addCountLine, loading: addingLine } = useAddStockCountLine();
  const { run: completeCount, loading: completing } = useCompleteStockCount();
  const { run: approveCount, loading: approving } = useApproveStockCount();
  const { run: createAdjustment, loading: creatingAdjustment } = useCreateStockAdjustment();
  const { run: approveAdjustment, loading: approvingAdjustment } = useApproveStockAdjustment();
  const { run: applyAdjustment, loading: applyingAdjustment } = useApplyStockAdjustment();

  const [scanning, setScanning] = useState(false);
  const busy =
    creating ||
    starting ||
    addingLine ||
    completing ||
    approving ||
    scanning ||
    creatingAdjustment ||
    approvingAdjustment ||
    applyingAdjustment;

  const counting = selectedCount?.status === "in_progress";

  async function load() {
    setError("");
    try {
      const [c, a] = await Promise.all([stockApi.listCounts(), stockApi.listAdjustments()]);
      setCounts(c.items ?? []);
      setAdjustments(a.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (counting) scanInputRef.current?.focus();
  }, [counting, selectedCount?.id]);

  async function refreshCount(id: string) {
    const c = await stockApi.getCount(id);
    setSelectedCount(c);
    return c;
  }

  async function handleCreateCount() {
    setError("");
    try {
      const c = await createCount({ warehouse_id: DEFAULT_WAREHOUSE_ID, count_type: "full" });
      setSelectedCount(c);
      setPendingSkuCounts({});
      setResolved(null);
      setInfo("Sessão de inventário criada — clique em Iniciar para começar a contagem.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleStartCount(id: string) {
    unlockScanAudio();
    try {
      await startCount(id);
      await refreshCount(id);
      setInfo("Contagem iniciada — escaneie QR codes ou digite códigos.");
      setScanInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  const resolveSku = useCallback(async (code: string): Promise<ResolvedItem> => {
    const sku = await pimApi.getSkuByCode(code);
    return {
      kind: "sku",
      code,
      skuId: sku.id,
      skuCode: sku.code,
      label: sku.name,
    };
  }, []);

  const resolveUnit = useCallback(async (code: string): Promise<ResolvedItem> => {
    const unit = await stockApi.unitDetailByCode(code);
    return {
      kind: "unit",
      code: unit.unit_code,
      skuId: unit.sku_id,
      skuCode: unit.sku_code,
      label: unit.product_name || unit.sku_name || unit.sku_code,
    };
  }, []);

  const registerUnit = useCallback(
    async (unitCode: string) => {
      if (!selectedCount) return;
      const c = await addCountLine({
        countId: selectedCount.id,
        body: { unit_code: unitCode },
      });
      setSelectedCount(c);
      setInfo(`Unidade ${unitCode} registrada na contagem.`);
      playScanBeep();
    },
    [selectedCount, addCountLine],
  );

  const registerSkuQty = useCallback(
    async (item: ResolvedItem, qty: number) => {
      if (!selectedCount || qty < 0) return;
      const c = await addCountLine({
        countId: selectedCount.id,
        body: { sku_id: item.skuId, counted_qty: qty },
      });
      setSelectedCount(c);
      setPendingSkuCounts((prev) => ({ ...prev, [item.skuId]: qty }));
      setInfo(`SKU ${item.skuCode}: ${qty} unidade(s) registrada(s).`);
      playScanBeep();
    },
    [selectedCount, addCountLine],
  );

  const processScan = useCallback(
    async (raw: string) => {
      if (!selectedCount || selectedCount.status !== "in_progress") {
        setError("Inicie uma sessão de contagem antes de escanear.");
        return;
      }

      const payload = parseQrPayload(raw);
      if (!payload) {
        setError("Código não reconhecido. Use etiqueta AAA ou SKU.");
        return;
      }

      setScanning(true);
      setError("");
      try {
        if (payload.kind === "unit") {
          const item = await resolveUnit(payload.code);
          setResolved(item);
          await registerUnit(item.code);
          setScanInput("");
          return;
        }

        const item = await resolveSku(payload.code);
        setResolved(item);

        if (autoIncrement) {
          const prev =
            pendingSkuCounts[item.skuId] ??
            selectedCount.lines?.find((l) => l.sku_code === item.skuCode)?.counted_qty ??
            0;
          const next = (typeof prev === "number" ? prev : 0) + 1;
          await registerSkuQty(item, next);
          setScanInput("");
          return;
        }

        setSkuQty(String((pendingSkuCounts[item.skuId] ?? 0) + 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao processar código");
      } finally {
        setScanning(false);
      }
    },
    [
      selectedCount,
      autoIncrement,
      pendingSkuCounts,
      resolveUnit,
      resolveSku,
      registerUnit,
      registerSkuQty,
    ],
  );

  async function onManualScan(e: FormEvent) {
    e.preventDefault();
    if (!scanInput.trim()) return;
    await processScan(scanInput);
  }

  async function submitSkuQty(e: FormEvent) {
    e.preventDefault();
    if (!resolved || resolved.kind !== "sku") return;
    const qty = parseInt(skuQty, 10);
    if (Number.isNaN(qty) || qty < 0) {
      setError("Informe uma quantidade válida.");
      return;
    }
    setError("");
    try {
      await registerSkuQty(resolved, qty);
      setScanInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar");
    }
  }

  async function handleCompleteCount() {
    if (!selectedCount) return;
    try {
      await completeCount(selectedCount.id);
      await refreshCount(selectedCount.id);
      setInfo("Contagem finalizada — aguardando aprovação.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleApproveCount() {
    if (!selectedCount) return;
    try {
      const c = await approveCount(selectedCount.id);
      setSelectedCount(c);
      setInfo("Inventário aprovado — ajustes gerados.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function handleCreateAdjustment(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createAdjustment({
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        sku_id: adjSku,
        quantity_delta: parseInt(adjDelta, 10) || 0,
        reason: adjReason,
      });
      setInfo("Ajuste solicitado");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao solicitar ajuste");
    }
  }

  async function approveAdj(id: string) {
    setError("");
    try {
      await approveAdjustment(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar ajuste");
    }
  }

  async function applyAdj(id: string) {
    setError("");
    try {
      await applyAdjustment(id);
      setInfo("Ajuste aplicado no estoque");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aplicar ajuste");
    }
  }

  const lineCount = selectedCount?.lines?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/estoque" className="hover:underline">
            Estoque
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Inventário e ajustes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Escaneie QR codes de unidades (AAA) ou SKUs, registre a contagem e finalize para aprovação.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Inventário">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleCreateCount()} disabled={busy}>
            Nova contagem
          </Button>
          {selectedCount ? (
            <>
              {selectedCount.status === "draft" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleStartCount(selectedCount.id)}
                >
                  Iniciar
                </Button>
              ) : null}
              {selectedCount.status === "in_progress" ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleCompleteCount()}>
                  Finalizar
                </Button>
              ) : null}
              {selectedCount.status === "pending_review" ? (
                <Button type="button" disabled={busy} onClick={() => void handleApproveCount()}>
                  Aprovar
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        {selectedCount ? (
          <p className="mb-4 text-sm text-slate-600">
            Sessão <span className="font-mono">{selectedCount.id.slice(0, 8)}…</span> · status:{" "}
            <strong>{selectedCount.status}</strong>
            {lineCount > 0 ? ` · ${lineCount} linha(s) registrada(s)` : null}
          </p>
        ) : null}

        {counting ? (
          <div className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Leitura de QR code</h3>
              <p className="mt-1 text-xs text-slate-600">
                Etiqueta de unidade (AAA) registra 1 peça por leitura. Etiqueta de SKU acumula quantidade
                {autoIncrement ? " (+1 a cada scan)" : " (informe a qtd abaixo)"}.
              </p>
            </div>

            <QrScanner onScan={(text) => void processScan(text)} disabled={busy} />

            <form className="flex flex-wrap items-end gap-3" onSubmit={onManualScan}>
              <div className="min-w-[220px] flex-1">
                <Field label="Código (QR, AAA ou SKU)">
                  <Input
                    inputRef={scanInputRef}
                    className="font-mono"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="AAA0001 ou 000042"
                    autoComplete="off"
                    disabled={busy}
                  />
                </Field>
              </div>
              <Button type="submit" disabled={busy || !scanInput.trim()}>
                Processar
              </Button>
            </form>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoIncrement}
                onChange={(e) => setAutoIncrement(e.target.checked)}
              />
              Incrementar +1 automaticamente ao escanear SKU
            </label>

            {resolved ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <p className="font-medium text-emerald-900">
                  {resolved.kind === "unit" ? "Unidade" : "SKU"}:{" "}
                  <span className="font-mono">{resolved.code}</span>
                </p>
                <p className="text-emerald-800">
                  {resolved.skuCode} — {resolved.label}
                </p>
              </div>
            ) : null}

            {resolved?.kind === "sku" && !autoIncrement ? (
              <form className="flex flex-wrap items-end gap-3" onSubmit={submitSkuQty}>
                <Field label="Qtd contada deste SKU">
                  <Input
                    type="number"
                    min={0}
                    value={skuQty}
                    onChange={(e) => setSkuQty(e.target.value)}
                    disabled={busy}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  Registrar quantidade
                </Button>
              </form>
            ) : null}
          </div>
        ) : selectedCount ? (
          <p className="mb-4 text-sm text-slate-500">Clique em Iniciar para habilitar o scanner.</p>
        ) : null}

        {selectedCount?.lines?.length ? (
          <Table
            headers={["SKU", "Unidade", "Sistema", "Contado", "Variância"]}
            rows={selectedCount.lines.map((l) => [
              l.sku_code ?? "—",
              l.unit_code ?? "—",
              l.system_qty,
              l.counted_qty ?? "—",
              l.variance,
            ])}
          />
        ) : null}

        <div className="mt-4">
          <Table
            headers={["ID", "Status", "Tipo", "Criado", ""]}
            rows={counts.map((c) => [
              c.id.slice(0, 8) + "…",
              c.status,
              c.count_type,
              new Date(c.created_at).toLocaleString("pt-BR"),
              c.status === "draft" || c.status === "in_progress" ? (
                <button
                  key={c.id}
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    setSelectedCount(c);
                    void refreshCount(c.id);
                  }}
                >
                  Abrir
                </button>
              ) : (
                "—"
              ),
            ])}
          />
        </div>
      </Card>

      <Card title="Ajustes manuais">
        <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={handleCreateAdjustment}>
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
            <Button type="submit" disabled={creatingAdjustment}>
              {creatingAdjustment ? "Solicitando…" : "Solicitar ajuste"}
            </Button>
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
                <button
                  type="button"
                  className="text-blue-600 hover:underline disabled:opacity-50"
                  disabled={approvingAdjustment}
                  onClick={() => void approveAdj(a.id)}
                >
                  Aprovar
                </button>
              ) : null}
              {a.status === "approved" ? (
                <button
                  type="button"
                  className="text-blue-600 hover:underline disabled:opacity-50"
                  disabled={applyingAdjustment}
                  onClick={() => void applyAdj(a.id)}
                >
                  Aplicar
                </button>
              ) : null}
            </div>,
          ])}
        />
      </Card>
    </div>
  );
}
