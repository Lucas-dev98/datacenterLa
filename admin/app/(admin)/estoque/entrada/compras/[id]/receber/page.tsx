"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BatchPhotoUploader, type BatchPhotoDraft } from "@/components/intake-batch-photos";
import { usePurchaseOrderReceive } from "@/hooks/use-purchase-order-receive";
import { purchasesApi, type PurchaseOrderDetail, type PurchaseOrderItem } from "@/lib/api/purchases";
import { stockApi } from "@/lib/api/stock";
import { API_URL } from "@/lib/config";
import type { InventoryUnitReceive } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

type POItem = PurchaseOrderItem;
type PO = PurchaseOrderDetail;

type View = "lista" | "sku";
type SkuStep = "detalhe" | "fotos" | "concluido";

function resolveImageSrc(url?: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("blob:")) return trimmed;
  return `${API_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function itemPending(item: POItem): number {
  return Math.max(0, item.quantity_ordered - item.quantity_received);
}

export default function ReceberPOPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error: loadError, loading, refetch } = usePurchaseOrderReceive(params.id);
  const po = data?.po ?? null;
  const skuById = data?.skuById ?? {};
  const [view, setView] = useState<View>("lista");
  const [skuStep, setSkuStep] = useState<SkuStep>("detalhe");
  const [activeSkuId, setActiveSkuId] = useState<string | null>(null);
  const [skuQty, setSkuQty] = useState(0);
  const [batchPhotos, setBatchPhotos] = useState<BatchPhotoDraft[]>([]);
  const [lastUnits, setLastUnits] = useState<InventoryUnitReceive[]>([]);
  const [nextCodes, setNextCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [codesLoading, setCodesLoading] = useState(false);
  const displayError = error || loadError;

  const pendingItems = useMemo(
    () => (po?.items ?? []).filter((i) => itemPending(i) > 0),
    [po],
  );

  const activeItem = useMemo(
    () => po?.items?.find((i) => i.sku_id === activeSkuId) ?? null,
    [po, activeSkuId],
  );
  const activeSku = activeSkuId ? skuById[activeSkuId] : undefined;
  const activePending = activeItem ? itemPending(activeItem) : 0;

  const activeRowIndex = useMemo(() => {
    if (view !== "lista" || !po?.items || !activeSkuId) return new Set<number>();
    const index = po.items.findIndex((i) => i.sku_id === activeSkuId);
    return index >= 0 ? new Set([index]) : new Set<number>();
  }, [po, activeSkuId, view]);

  const totalPendingUnits = useMemo(
    () => pendingItems.reduce((n, i) => n + itemPending(i), 0),
    [pendingItems],
  );

  const loadNextCodes = useCallback(async (count: number) => {
    if (count <= 0) {
      setNextCodes([]);
      return;
    }
    setCodesLoading(true);
    try {
      const res = await stockApi.peekNextUnitCodes(count);
      setNextCodes(res.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reservar códigos AAA");
    } finally {
      setCodesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "sku" && skuStep === "fotos") void loadNextCodes(skuQty);
  }, [view, skuStep, skuQty, loadNextCodes]);

  function resetSkuSession() {
    batchPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
    setBatchPhotos([]);
    setNextCodes([]);
    setLastUnits([]);
    setSkuStep("detalhe");
  }

  function openSkuReceive(skuId: string) {
    const item = po?.items?.find((i) => i.sku_id === skuId);
    if (!item || itemPending(item) <= 0) return;
    resetSkuSession();
    setActiveSkuId(skuId);
    setSkuQty(itemPending(item));
    setView("sku");
    setSkuStep("detalhe");
    setError("");
    setInfo("");
  }

  function backToList() {
    resetSkuSession();
    setView("lista");
    setActiveSkuId(null);
    setError("");
  }

  function goToSkuPhotos(e: FormEvent) {
    e.preventDefault();
    if (skuQty < 1 || skuQty > activePending) {
      setError(`Informe entre 1 e ${activePending} unidade(s) para este SKU.`);
      return;
    }
    setError("");
    setSkuStep("fotos");
  }

  async function submitSkuReceive(e: FormEvent) {
    e.preventDefault();
    if (!po || !activeSkuId || skuQty < 1 || batchPhotos.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = { items: [{ sku_id: activeSkuId, quantity: skuQty }] };
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      batchPhotos.forEach((photo, index) => {
        form.append(`batch_photo_${index}`, photo.file);
      });

      const res = await purchasesApi.receiveIntake(po.id, form);
      setLastUnits(res.units ?? []);
      batchPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
      setBatchPhotos([]);
      await refetch();
      setSkuStep("concluido");
      setInfo(`${res.units?.length ?? 0} unidade(s) de ${activeSku?.name ?? "SKU"} registrada(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no recebimento");
    } finally {
      setSubmitting(false);
    }
  }

  function openNextPending(skipSkuId?: string) {
    const updated = po?.items ?? [];
    const next = updated.find((i) => itemPending(i) > 0 && i.sku_id !== (skipSkuId ?? activeSkuId));
    const fallback = updated.find((i) => itemPending(i) > 0);
    const target = next ?? fallback;
    if (target) openSkuReceive(target.sku_id);
    else backToList();
  }

  const activeStillPending = useMemo(() => {
    if (!activeSkuId || !po) return 0;
    const item = po.items?.find((i) => i.sku_id === activeSkuId);
    return item ? itemPending(item) : 0;
  }, [po, activeSkuId]);

  if (loading) return <p className="p-6 text-sm text-slate-500">Carregando PO…</p>;
  if (!po) return <Alert tone="error">{displayError || "PO não encontrada"}</Alert>;

  const canReceive = po.status === "ordered" || po.status === "partial";
  const codeRange =
    nextCodes.length > 1
      ? `${nextCodes[0]} … ${nextCodes[nextCodes.length - 1]}`
      : (nextCodes[0] ?? "");
  const poComplete = pendingItems.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/estoque/entrada/compras" className="hover:underline">
            Receber compra
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{po.po_number}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {po.supplier_name} ·{" "}
          {poComplete
            ? "PO totalmente recebida"
            : canReceive
              ? `Recebimento SKU a SKU · ${totalPendingUnits} un. pendentes`
              : po.status}
        </p>
      </header>

      {view === "lista" ? (
        <ol className="flex flex-wrap gap-2 text-xs font-medium">
          <li className="rounded-full bg-blue-600 px-3 py-1 text-white">1. Escolher SKU</li>
          <li className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">2. Fotos e códigos</li>
          <li className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">3. Próximo SKU</li>
        </ol>
      ) : (
        <ol className="flex flex-wrap gap-2 text-xs font-medium">
          <li className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">1. SKU</li>
          <li
            className={`rounded-full px-3 py-1 ${
              skuStep === "detalhe" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            2. {activeSku?.code ?? "Produto"}
          </li>
          <li
            className={`rounded-full px-3 py-1 ${
              skuStep === "fotos" ? "bg-blue-600 text-white" : skuStep === "concluido" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            3. {skuStep === "concluido" ? "Registrado" : "Fotos e códigos"}
          </li>
        </ol>
      )}

      {displayError ? <Alert tone="error">{displayError}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      {poComplete && view === "lista" ? (
        <Alert tone="success">
          Todos os itens desta PO foram recebidos.{" "}
          <Link href="/estoque/entrada/recebimento" className="font-medium text-blue-700 hover:underline">
            Ir para fila de recebimento
          </Link>{" "}
          para testes e liberação.
        </Alert>
      ) : null}

      {!canReceive && !poComplete ? (
        <Alert tone="warning">Esta PO não está aguardando recebimento.</Alert>
      ) : null}

      {view === "lista" ? (
        <Card title="Itens da PO — receba SKU a SKU">
          <p className="mb-4 text-sm text-slate-600">
            Clique em um item pendente para abrir o recebimento daquele produto: quantidade, fotos do lote e códigos
            AAA. Repita até concluir todos os SKUs.
          </p>
          <Table
            headers={["SKU", "Produto", "Pedido", "Recebido", "Pendente", "Status"]}
            rows={(po.items ?? []).map((i) => {
              const pending = itemPending(i);
              const sku = skuById[i.sku_id];
              const done = pending === 0;
              return [
                <span key={`c-${i.sku_id}`} className="font-mono font-medium">
                  {i.sku_code ?? sku?.code ?? i.sku_id.slice(0, 8)}
                </span>,
                sku?.name ?? "—",
                i.quantity_ordered,
                i.quantity_received,
                pending,
                done ? (
                  <span key={`s-${i.sku_id}`} className="text-emerald-700">
                    Concluído
                  </span>
                ) : (
                  <span key={`s-${i.sku_id}`} className="text-amber-700">
                    Pendente
                  </span>
                ),
              ];
            })}
            selectedRowIndices={activeRowIndex}
            onRowClick={(index) => {
              const item = po.items?.[index];
              if (item && itemPending(item) > 0 && canReceive) openSkuReceive(item.sku_id);
              else if (item) setActiveSkuId(item.sku_id);
            }}
            onRowDoubleClick={(index) => {
              const item = po.items?.[index];
              if (item && itemPending(item) > 0 && canReceive) openSkuReceive(item.sku_id);
            }}
          />
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Link href="/estoque/entrada/compras">
              <Button type="button" variant="secondary">
                Voltar
              </Button>
            </Link>
            {pendingItems.length > 0 && canReceive ? (
              <Button type="button" onClick={() => openSkuReceive(pendingItems[0].sku_id)}>
                Receber primeiro pendente
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {view === "sku" && activeItem && skuStep === "detalhe" ? (
        <Card title={`Receber — ${activeSku?.name ?? activeItem.sku_code ?? "SKU"}`}>
          <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
            <div className="flex items-start justify-center rounded-lg border border-slate-200 bg-slate-50 p-3">
              {activeSku?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageSrc(activeSku.image_url)}
                  alt={activeSku.name}
                  className="max-h-44 w-full object-contain"
                />
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">Sem foto</p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-mono text-sm text-blue-700">
                  {activeItem.sku_code ?? activeSku?.code ?? activeItem.sku_id.slice(0, 8)}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{activeSku?.name ?? "Produto"}</h2>
                {activeSku?.description ? (
                  <p className="mt-2 text-sm text-slate-600">{activeSku.description}</p>
                ) : null}
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-slate-500">Pedido na PO</dt>
                  <dd className="font-medium">{activeItem.quantity_ordered}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-slate-500">Já recebido</dt>
                  <dd className="font-medium">{activeItem.quantity_received}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-slate-500">Pendente</dt>
                  <dd className="font-medium">{activePending}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-slate-500">Custo landed USD</dt>
                  <dd className="font-medium">
                    ${(activeItem.unit_landed_cost_usd ?? activeItem.unit_cost_usd).toFixed(2)}/un.
                  </dd>
                </div>
              </dl>

              <Field label={`Quantidade a receber agora (máx. ${activePending})`}>
                <Input
                  type="number"
                  min={1}
                  max={activePending}
                  value={skuQty}
                  onChange={(e) => setSkuQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </Field>

              <p className="text-xs text-slate-500">
                Na próxima etapa você tira fotos deste lote e recebe os códigos AAA para colar nas{" "}
                {skuQty || "—"} unidade(s).
              </p>
            </div>
          </div>

          <form className="mt-6 flex flex-wrap justify-end gap-2" onSubmit={goToSkuPhotos}>
            <Button type="button" variant="secondary" onClick={backToList}>
              Voltar à lista
            </Button>
            <Button type="submit" disabled={skuQty < 1 || skuQty > activePending}>
              Continuar — fotos e códigos ({skuQty} un.)
            </Button>
          </form>
        </Card>
      ) : null}

      {view === "sku" && activeItem && skuStep === "fotos" ? (
        <Card title={`Fotos e códigos — ${activeSku?.name ?? activeItem.sku_code}`}>
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-mono font-medium text-blue-800">
              {activeItem.sku_code ?? activeSku?.code} — {activeSku?.name}
            </p>
            <p className="mt-1 text-slate-600">
              Registrando <strong>{skuQty}</strong> unidade(s) deste SKU.
            </p>
          </div>

          {codesLoading ? (
            <p className="text-sm text-slate-500">Carregando códigos AAA…</p>
          ) : nextCodes.length > 0 ? (
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium">
                Cole nas unidades: <span className="font-mono text-blue-700">{codeRange}</span>
              </p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
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

          <form className="mt-6 flex flex-wrap justify-end gap-2" onSubmit={submitSkuReceive}>
            <Button type="button" variant="secondary" onClick={() => setSkuStep("detalhe")}>
              Voltar
            </Button>
            <Button type="submit" disabled={submitting || batchPhotos.length === 0 || codesLoading}>
              {submitting ? "Registrando…" : `Registrar ${skuQty} unidade(s)`}
            </Button>
          </form>
        </Card>
      ) : null}

      {view === "sku" && skuStep === "concluido" ? (
        <Card title="SKU registrado">
          <p className="text-sm text-slate-600">
            {lastUnits.length} unidade(s) criada(s)
            {lastUnits[0]?.unit_code ? (
              <>
                {" "}
                — códigos <span className="font-mono">{lastUnits[0].unit_code}</span>
                {lastUnits.length > 1 ? ` … ${lastUnits[lastUnits.length - 1]?.unit_code}` : ""}
              </>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Unidades na fila como <strong>received</strong>. Inspecione e teste em{" "}
            <Link href="/estoque/entrada/recebimento" className="text-blue-600 hover:underline">
              Fila de recebimento
            </Link>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {activeStillPending > 0 ? (
              <Button type="button" onClick={() => activeSkuId && openSkuReceive(activeSkuId)}>
                Receber mais deste SKU ({activeStillPending} un.)
              </Button>
            ) : null}
            {pendingItems.length > 0 ? (
              <Button type="button" onClick={() => openNextPending()}>
                Próximo SKU pendente
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={backToList}>
              Voltar à lista da PO
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/estoque/entrada/recebimento")}>
              Ir para testes
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
