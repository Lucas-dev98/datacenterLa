"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, apiBlob, blobObjectUrl, createCustomerReturnWithPhotos } from "@/lib/api";
import type { Order, OrderItem, OrderListItem } from "@/lib/types";
import { BatchPhotoUploader, type BatchPhotoDraft } from "@/components/intake-batch-photos";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

type ReturnPhoto = { id: string; return_id: string; created_at: string };

type CustomerReturn = {
  id: string;
  return_number: string;
  order_number?: string;
  customer_name?: string;
  status: string;
  reason: string;
  condition_notes?: string;
  within_return_window: boolean;
  return_window_days?: number;
  return_expires_at?: string;
  photos?: ReturnPhoto[];
  resolution?: string;
  created_at: string;
};

type ReturnWindowCheck = {
  return_window_days: number;
  return_expires_at?: string;
  within_return_window: boolean;
};

function ReturnPhotoThumb({ returnId, photoId, alt }: { returnId: string; photoId: string; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      try {
        const blob = await apiBlob(`/api/v1/sales/returns/${returnId}/photos/${photoId}/file`);
        if (cancelled) return;
        objectUrl = blobObjectUrl(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl("");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [returnId, photoId]);
  if (!url) return <span className="inline-block h-16 w-16 rounded-lg bg-slate-100" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
    </a>
  );
}

export default function DevolucoesPage() {
  const [items, setItems] = useState<CustomerReturn[]>([]);
  const [caseSearch, setCaseSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderResults, setOrderResults] = useState<OrderListItem[]>([]);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [photos, setPhotos] = useState<BatchPhotoDraft[]>([]);
  const [windowInfo, setWindowInfo] = useState<ReturnWindowCheck | null>(null);
  const [eligibleUnits, setEligibleUnits] = useState<number | null>(null);
  const [resolveById, setResolveById] = useState<Record<string, string>>({});
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOrderLabel, setSelectedOrderLabel] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [expandedCase, setExpandedCase] = useState<CustomerReturn | null>(null);

  const loadCases = useCallback(async (q?: string) => {
    const term = (q ?? caseSearch).trim();
    const qs = term ? `?q=${encodeURIComponent(term)}` : "";
    const res = await api<{ items: CustomerReturn[] }>(`/api/v1/sales/returns${qs}`);
    setItems(res.items ?? []);
  }, [caseSearch]);

  const searchOrders = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) {
      setOrderResults([]);
      return;
    }
    setSearchingOrders(true);
    setError("");
    try {
      const res = await api<{ items: OrderListItem[] }>(
        `/api/v1/sales/orders?status=shipped&q=${encodeURIComponent(q)}&limit=20`,
      );
      setOrderResults(res.items ?? []);
    } catch (err) {
      setOrderResults([]);
      setError(err instanceof Error ? err.message : "Erro ao buscar pedidos");
    } finally {
      setSearchingOrders(false);
    }
  }, []);

  useEffect(() => {
    const term = caseSearch.trim();
    const t = setTimeout(() => {
      void loadCases(term).catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar devoluções");
      });
    }, term ? 300 : 0);
    return () => clearTimeout(t);
  }, [caseSearch, loadCases]);

  useEffect(() => {
    const term = orderSearch.trim();
    if (!term) {
      setOrderResults([]);
      return;
    }
    const t = setTimeout(() => void searchOrders(term), 300);
    return () => clearTimeout(t);
  }, [orderSearch, searchOrders]);

  useEffect(() => {
    if (!expandedId) {
      setExpandedCase(null);
      return;
    }
    void (async () => {
      try {
        setExpandedCase(await api<CustomerReturn>(`/api/v1/sales/returns/${expandedId}`));
      } catch {
        setExpandedCase(items.find((c) => c.id === expandedId) ?? null);
      }
    })();
  }, [expandedId, items]);

  useEffect(() => {
    if (!orderId) {
      setOrderItems([]);
      setOrderItemId("");
      setWindowInfo(null);
      return;
    }
    void (async () => {
      setLoadingOrder(true);
      setError("");
      try {
        const [order, windowRes] = await Promise.all([
          api<Order>(`/api/v1/sales/orders/${orderId}`),
          api<ReturnWindowCheck>(`/api/v1/sales/returns/window-check?order_id=${encodeURIComponent(orderId)}`),
        ]);
        const lines = order.items ?? [];
        setOrderItems(lines);
        setOrderItemId(lines[0]?.id ?? "");
        setQuantity(1);
        setWindowInfo(windowRes);
      } catch (err) {
        setOrderItems([]);
        setError(err instanceof Error ? err.message : "Erro ao carregar pedido");
      } finally {
        setLoadingOrder(false);
      }
    })();
  }, [orderId]);

  useEffect(() => {
    if (!orderId || !orderItemId) {
      setEligibleUnits(null);
      return;
    }
    void (async () => {
      try {
        const res = await api<{ eligible_units: number }>(
          `/api/v1/sales/returns/eligibility?order_id=${encodeURIComponent(orderId)}&order_item_id=${encodeURIComponent(orderItemId)}`,
        );
        setEligibleUnits(res.eligible_units);
      } catch {
        setEligibleUnits(null);
      }
    })();
  }, [orderId, orderItemId]);

  const selectedLine = orderItems.find((l) => l.id === orderItemId);
  const canOpen =
    Boolean(orderId && selectedLine && reason.trim())
    && (windowInfo?.within_return_window ?? false)
    && (eligibleUnits ?? 0) >= quantity;

  function selectOrder(order: OrderListItem) {
    setOrderId(order.id);
    setSelectedOrderLabel(`${order.order_number} — ${order.customer_name}`);
    setOrderSearch("");
    setOrderResults([]);
    if (order.matched_order_item_id) setOrderItemId(order.matched_order_item_id);
  }

  function clearOrder() {
    setOrderId("");
    setOrderItems([]);
    setSelectedOrderLabel("");
    setWindowInfo(null);
    setEligibleUnits(null);
  }

  async function createReturn(e: FormEvent) {
    e.preventDefault();
    if (!canOpen || !selectedLine) {
      if (windowInfo && !windowInfo.within_return_window) {
        setError("Prazo de devolução expirado — não é possível registrar nova solicitação.");
      } else if (eligibleUnits === 0) {
        setError("Nenhuma unidade elegível neste item — a peça pode já ter sido devolvida.");
      } else if (eligibleUnits !== null && eligibleUnits < quantity) {
        setError(`Quantidade solicitada excede as ${eligibleUnits} unidade(s) elegível(eis).`);
      } else {
        setError("Preencha o pedido, item e motivo da devolução.");
      }
      return;
    }
    setSubmitting(true);
    setError("");
    setInfo("");
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          order_id: orderId,
          reason: reason.trim(),
          condition_notes: conditionNotes.trim() || undefined,
          items: [{ order_item_id: selectedLine.id, sku_id: selectedLine.sku_id, quantity }],
        }),
      );
      photos.forEach((photo, index) => {
        form.set(`photo_${index}`, photo.file, photo.file.name || `return-${index + 1}.jpg`);
      });
      await createCustomerReturnWithPhotos(form);
      setInfo("Devolução registrada — aguardando aprovação.");
      clearOrder();
      setReason("");
      setConditionNotes("");
      setPhotos([]);
      setQuantity(1);
      await loadCases(caseSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar devolução");
    } finally {
      setSubmitting(false);
    }
  }

  async function action(id: string, step: "approve" | "receive" | "resolve", resolution?: string) {
    setError("");
    try {
      await api(`/api/v1/sales/returns/${id}/${step}`, {
        method: "POST",
        body: step === "resolve" ? JSON.stringify({ resolution: resolution ?? "restock" }) : undefined,
      });
      setInfo(`Devolução: ${step}`);
      await loadCases(caseSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na ação");
    }
  }

  function statusLabel(status: string): string {
    switch (status) {
      case "requested": return "Solicitada";
      case "approved": return "Aprovada — aguardando recebimento";
      case "received": return "Recebida — aguardando resolução";
      case "resolved": return "Resolvida";
      default: return status;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Devoluções</h1>
        <p className="mt-1 text-sm text-slate-600">
          Retorno comercial de pedidos expedidos — arrependimento, troca ou reembolso dentro do prazo configurado.
          {" "}
          <Link href="/rma" className="text-blue-600 hover:underline">Defeito técnico / garantia → RMA</Link>
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Registrar devolução">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={createReturn}>
          <div className="sm:col-span-2">
            <Field label="Buscar pedido expedido" hint="Pedido, cliente, documento ou código AAA">
              {orderId ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                    <span className="font-medium text-emerald-900">{selectedOrderLabel}</span>
                    <button type="button" className="text-emerald-700 underline" onClick={clearOrder}>Trocar</button>
                  </div>
                  {windowInfo ? (
                    <p className={`text-xs ${windowInfo.within_return_window ? "text-emerald-700" : "text-red-700"}`}>
                      Prazo de devolução: {windowInfo.return_window_days} dias
                      {windowInfo.return_expires_at
                        ? ` · até ${new Date(windowInfo.return_expires_at).toLocaleDateString("pt-BR")}`
                        : ""}
                      {windowInfo.within_return_window ? " · dentro do prazo" : " · prazo expirado"}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Ex.: PED-001020, Lucas, AAA0142"
                    />
                    <Button type="button" variant="secondary" disabled={searchingOrders} onClick={() => void searchOrders(orderSearch)}>
                      Buscar
                    </Button>
                  </div>
                  {orderResults.length > 0 ? (
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
                      {orderResults.map((o) => (
                        <li key={o.id}>
                          <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => selectOrder(o)}>
                            <span className="font-mono font-medium">{o.order_number}</span> — {o.customer_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </Field>
          </div>

          <Field label="Item">
            <Select value={orderItemId} onChange={(e) => setOrderItemId(e.target.value)} disabled={!orderId || loadingOrder}>
              {orderItems.map((line) => (
                <option key={line.id} value={line.id}>
                  {(line.sku_code ?? line.sku_id.slice(0, 8))} · qtd {line.quantity}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantidade">
            <Input type="number" min={1} max={Math.min(selectedLine?.quantity ?? 1, eligibleUnits ?? selectedLine?.quantity ?? 1)} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} disabled={!selectedLine} />
          </Field>

          {eligibleUnits === 0 && orderId && orderItemId ? (
            <div className="sm:col-span-2">
              <Alert tone="error">
                Nenhuma unidade vendida elegível neste item — a peça pode já ter sido devolvida ou encaminhada ao RMA.
              </Alert>
            </div>
          ) : null}
          {eligibleUnits !== null && eligibleUnits > 0 && eligibleUnits < quantity ? (
            <div className="sm:col-span-2">
              <Alert tone="error">
                Quantidade solicitada ({quantity}) excede as unidades elegíveis ({eligibleUnits}).
              </Alert>
            </div>
          ) : null}
          {windowInfo && !windowInfo.within_return_window && orderId ? (
            <div className="sm:col-span-2">
              <Alert tone="error">Prazo de devolução expirado — não é possível abrir nova solicitação para este pedido.</Alert>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Field label="Motivo da devolução">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Ex.: arrependimento, produto errado, embalagem intacta" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Estado da peça / embalagem" hint="Conferência visual na abertura">
              <textarea
                className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="Ex.: caixa lacrada, sem marcas de uso…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-900">Fotos do produto (opcional)</p>
            <BatchPhotoUploader photos={photos} maxPhotos={5} variant="returns" onChange={setPhotos} />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={!canOpen || submitting}>
              {submitting ? "Registrando…" : "Solicitar devolução"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Devoluções registradas">
        <div className="mb-4">
          <Field label="Buscar">
            <Input value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} placeholder="DEV-…, pedido, cliente, AAA" />
          </Field>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma devolução.</p>
        ) : (
          <Table
            headers={["Devolução", "Pedido", "Cliente", "Status", "Prazo", "Motivo", ""]}
            rows={items.map((r) => [
              <button key={`n-${r.id}`} type="button" className="font-mono text-blue-600 hover:underline" onClick={() => setExpandedId(expandedId === r.id ? "" : r.id)}>
                {r.return_number}
              </button>,
              r.order_number ?? "—",
              r.customer_name ?? "—",
              statusLabel(r.status),
              r.within_return_window ? <span className="text-emerald-700">OK</span> : <span className="text-red-700">Expirado</span>,
              r.reason,
              <div key={`a-${r.id}`} className="flex flex-wrap gap-2">
                {r.status === "requested" ? (
                  <button type="button" className="text-blue-600 hover:underline disabled:text-slate-400" disabled={!r.within_return_window} onClick={() => void action(r.id, "approve")}>Aprovar</button>
                ) : null}
                {r.status === "approved" ? (
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void action(r.id, "receive")}>Receber</button>
                ) : null}
                {r.status === "received" ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Select
                      value={resolveById[r.id] ?? "restock"}
                      onChange={(e) => setResolveById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    >
                      <option value="restock">Restock</option>
                      <option value="refund">Reembolso</option>
                      <option value="reject">Rejeitar</option>
                    </Select>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => void action(r.id, "resolve", resolveById[r.id] ?? "restock")}
                    >
                      Resolver
                    </button>
                  </span>
                ) : null}
              </div>,
            ])}
          />
        )}

        {expandedCase ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
            {expandedCase.condition_notes ? <p><strong>Estado:</strong> {expandedCase.condition_notes}</p> : null}
            {expandedCase.resolution ? <p><strong>Resolução:</strong> {expandedCase.resolution}</p> : null}
            {(expandedCase.photos ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(expandedCase.photos ?? []).map((p, i) => (
                  <ReturnPhotoThumb key={p.id} returnId={expandedCase.id} photoId={p.id} alt={`Foto ${i + 1}`} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
