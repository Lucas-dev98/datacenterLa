"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { downloadBlob } from "@/lib/api/client";
import {
  useIntakeAdvance,
  useIntakeComplete,
  useUnitByCode,
} from "@/hooks/use-stock-intake-mutations";
import { useIntakeQueue } from "@/hooks/use-intake-queue";
import { stockApi } from "@/lib/api/stock";
import { DEFAULT_LOCATION_ID } from "@/lib/config";
import type { InventoryUnit } from "@/lib/types";
import { IntakeBatchPhotoGallery, IntakePhotoThumb } from "@/components/intake-batch-photos";
import { IntakeTestPanel } from "@/components/intake-test-panel";
import { intakeStatusLabel } from "@/lib/status-labels";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

const ACTION_LABEL: Record<string, string> = {
  inspecionar: "Inspecionar",
  identificar: "Identificar",
  liberar: "Liberar",
};

function actionButtonLabel(nextAction: string): string {
  return ACTION_LABEL[nextAction] ?? "Avançar";
}

export default function RecebimentoPage() {
  const { data: queueItems, error: loadError, loading, refetch } = useIntakeQueue();
  const items = queueItems ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanCode, setScanCode] = useState("");
  const [printOnRelease, setPrintOnRelease] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const { run: intakeAdvance, loading: advancing } = useIntakeAdvance();
  const { run: intakeComplete, loading: completing } = useIntakeComplete();
  const { run: lookupUnit, loading: scanning } = useUnitByCode();
  const submitting = advancing || completing || scanning;
  const [activeTestUnit, setActiveTestUnit] = useState<{ id: string; code: string } | null>(null);

  const batchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (item.intake_batch_id && (item.batch_photo_count ?? 0) > 0) {
        ids.add(item.intake_batch_id);
      }
    }
    return [...ids];
  }, [items]);

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  async function reloadQueue() {
    await refetch();
    setSelected(new Set());
  }

  async function printUnitLabel(unitCode: string) {
    const blob = await stockApi.unitLabelPdf(unitCode);
    downloadBlob(blob, `etiqueta-${unitCode}.pdf`);
  }

  async function advanceOne(unitId: string, unitCode: string, nextAction: string) {
    setError("");
    setInfo("");
    try {
      const body: { unit_id: string; location_id?: string } = { unit_id: unitId };
      if (nextAction === "liberar") {
        body.location_id = DEFAULT_LOCATION_ID;
      }
      const res = await intakeAdvance(body);
      if (res.unit.status === "available" && printOnRelease) {
        await printUnitLabel(unitCode);
      }
      setInfo(`Unidade ${unitCode}: ${intakeStatusLabel(res.unit.status ?? "")}`);
      await reloadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao avançar");
    }
  }

  async function advanceBatch(unitIds: string[], mode: "step" | "complete") {
    if (unitIds.length === 0) return;
    setError("");
    setInfo("");
    try {
      const released: string[] = [];
      let ok = 0;
      let failed = 0;

      if (mode === "complete") {
        const res = await intakeComplete({
          unit_ids: unitIds,
          location_id: DEFAULT_LOCATION_ID,
        });
        const done = res.completed ?? (res.unit ? [res.unit] : []);
        ok = done.length;
        failed = res.failed?.length ?? unitIds.length - ok;
        for (const u of done) {
          if (u.status === "available") released.push(u.unit_code);
        }
      } else {
        for (const id of unitIds) {
          const item = items.find((i) => i.id === id);
          try {
            const body: { unit_id: string; location_id?: string } = { unit_id: id };
            if (item?.next_action === "liberar") {
              body.location_id = DEFAULT_LOCATION_ID;
            }
            const res = await intakeAdvance(body);
            ok++;
            if (res.unit.status === "available") released.push(res.unit.unit_code);
          } catch {
            failed++;
          }
        }
      }

      if (failed > 0) setError(`${failed} unidade(s) falharam`);
      if (ok > 0) setInfo(`${ok} unidade(s) processada(s)`);
      if (printOnRelease && released.length > 0) {
        for (const code of released) {
          await printUnitLabel(code);
        }
      }
      await reloadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar");
    }
  }

  async function onScan(e: FormEvent) {
    e.preventDefault();
    const code = scanCode.trim().toUpperCase();
    if (!code) return;
    setError("");
    setInfo("");
    try {
      const unit = await lookupUnit(code);
      const status = unit.status ?? unit.Status ?? "";
      if (!["received", "inspecting", "identified"].includes(status)) {
        setError(`Unidade ${code} não está na fila (status: ${status || "?"})`);
        return;
      }
      if (status === "inspecting") {
        setActiveTestUnit({ id: unit.id, code });
        setScanCode("");
        setInfo(`Unidade ${code} aberta para teste com fotos.`);
        return;
      }
      const inQueue = items.find((i) => i.id === unit.id);
      const nextAction = inQueue?.next_action ?? (status === "identified" ? "liberar" : status === "inspecting" ? "identificar" : "inspecionar");
      await advanceOne(unit.id, code, nextAction);
      setScanCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código não encontrado");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/estoque/entrada" className="hover:underline">
              Entrada
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Fila de recebimento</h1>
          <p className="mt-1 text-sm text-slate-600">
            Inspeção → teste com fotos → identificação → liberação. Reprovação abre devolução ao fornecedor.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void reloadQueue()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Scanner">
        <form className="flex flex-wrap items-end gap-4" onSubmit={onScan}>
          <div className="min-w-[200px] flex-1">
            <Field label="Código da unidade">
              <Input
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                placeholder="AAA0001"
                className="font-mono"
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={printOnRelease}
              onChange={(e) => setPrintOnRelease(e.target.checked)}
            />
            Imprimir etiqueta ao liberar
          </label>
          <Button type="submit" disabled={submitting || !scanCode.trim()}>
            Avançar (scanner)
          </Button>
        </form>
      </Card>

      {batchIds.length > 0 ? (
        <Card title="Fotos dos lotes aguardando liberação">
          <div className="grid gap-4 sm:grid-cols-2">
            {batchIds.map((batchId) => (
              <IntakeBatchPhotoGallery key={batchId} batchId={batchId} />
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={selected.size === 0 || submitting}
            onClick={() => void advanceBatch([...selected], "step")}
          >
            Avançar 1 passo ({selected.size})
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || submitting}
            onClick={() => void advanceBatch([...selected], "complete")}
          >
            Liberar completo ({selected.size})
          </Button>
          {items.length > 0 ? (
            <button type="button" className="text-sm text-blue-600 hover:underline" onClick={toggleAll}>
              {selected.size === items.length ? "Desmarcar todas" : "Selecionar todas"}
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando fila…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma unidade pendente. Receba mercadoria em{" "}
            <Link href="/estoque/entrada/compras" className="text-blue-600 hover:underline">
              Compras (PO)
            </Link>
            {" "}ou{" "}
            <Link href="/estoque/entrada/avulsa" className="text-blue-600 hover:underline">
              entrada avulsa
            </Link>
            .
          </p>
        ) : (
          <Table
            headers={["", "Foto", "Código AAA", "SKU", "PO", "Status", "Próximo", "Custo", "Recebido", ""]}
            rows={items.map((item) => [
              <input
                key={`cb-${item.id}`}
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                aria-label={`Selecionar ${item.unit_code}`}
              />,
              item.has_intake_photo ? (
                <IntakePhotoThumb
                  key={`ph-${item.id}`}
                  batchId={item.intake_batch_id}
                  unitId={item.id}
                  alt={`Foto ${item.unit_code}`}
                />
              ) : (
                <span key={`ph-${item.id}`} className="text-xs text-slate-400">—</span>
              ),
              <span key={`c-${item.id}`} className="font-mono font-medium">
                {item.unit_code}
              </span>,
              `${item.sku_code}${item.sku_name ? ` — ${item.sku_name}` : ""}`,
              item.purchase_id ? (
                <Link key={`po-${item.id}`} href={`/compras/${item.purchase_id}`} className="text-blue-600 hover:underline">
                  {item.po_number ?? item.purchase_id.slice(0, 8)}
                </Link>
              ) : (
                "—"
              ),
              intakeStatusLabel(item.status),
              item.next_action,
              item.unit_cost_usd != null ? item.unit_cost_usd.toFixed(2) : "—",
              item.received_at ? new Date(item.received_at).toLocaleString("pt-BR") : "—",
              <span key={`a-${item.id}`} className="flex flex-col gap-2">
                {item.status === "inspecting" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => setActiveTestUnit({ id: item.id, code: item.unit_code })}
                  >
                    Testar / fotos
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={submitting}
                      onClick={() => void advanceOne(item.id, item.unit_code, item.next_action)}
                    >
                      {actionButtonLabel(item.next_action)}
                    </Button>
                    {item.next_action !== "liberar" ? (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        disabled={submitting}
                        onClick={() => void advanceBatch([item.id], "complete")}
                      >
                        Liberar tudo
                      </button>
                    ) : null}
                  </>
                )}
              </span>,
            ])}
          />
        )}
      </Card>

      {activeTestUnit ? (
        <Card title={`Teste — ${activeTestUnit.code}`}>
          <IntakeTestPanel
            unitId={activeTestUnit.id}
            unitCode={activeTestUnit.code}
            onDone={() => {
              setActiveTestUnit(null);
              void reloadQueue();
            }}
          />
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={() => setActiveTestUnit(null)}>
              Fechar
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
