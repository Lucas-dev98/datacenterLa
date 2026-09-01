"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiClientError, blobObjectUrl } from "@/lib/api/client";
import { useCreateRMA } from "@/hooks/use-create-rma";
import { useRmaCasesList } from "@/hooks/use-rma-cases-list";
import { useRmaStep } from "@/hooks/use-rma-step";
import { rmaApi, type RMACase, type WarrantyCheck } from "@/lib/api/rma";
import type { OrderItem, OrderListItem } from "@/lib/types";
import { BatchPhotoUploader, type BatchPhotoDraft } from "@/components/intake-batch-photos";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

function RMATestPhotoThumb({ caseId, photoId, alt }: { caseId: string; photoId: string; alt: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      try {
        const blob = await rmaApi.testPhotoBlob(caseId, photoId);
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
  }, [caseId, photoId]);

  if (!url) return <span className="inline-block h-16 w-16 rounded-lg bg-slate-100" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
    </a>
  );
}

export default function RMAPage() {
  const [caseSearch, setCaseSearch] = useState("");
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const { data: casesData, error: listError, refetch: refetchCases } = useRmaCasesList(caseSearchTerm);
  const items = casesData ?? [];
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
  const [testNotes, setTestNotes] = useState("");
  const [defectConfirmed, setDefectConfirmed] = useState(true);
  const [testPhotos, setTestPhotos] = useState<BatchPhotoDraft[]>([]);
  const [warranty, setWarranty] = useState<WarrantyCheck | null>(null);
  const [eligibleUnits, setEligibleUnits] = useState<number | null>(null);
  const [resolveById, setResolveById] = useState<Record<string, string>>({});
  const [loadingOrder, setLoadingOrder] = useState(false);
  const { run: submitRMA, loading: submitting, setError: setRmaMutationError } = useCreateRMA();
  const { run: runRmaStep } = useRmaStep();
  const [selectedOrderLabel, setSelectedOrderLabel] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState("");
  const [expandedCase, setExpandedCase] = useState<RMACase | null>(null);

  useEffect(() => {
    if (listError) setError(listError);
  }, [listError]);

  useEffect(() => {
    const term = caseSearch.trim();
    const t = setTimeout(() => setCaseSearchTerm(term), term ? 300 : 0);
    return () => clearTimeout(t);
  }, [caseSearch]);

  useEffect(() => {
    if (!expandedCaseId) {
      setExpandedCase(null);
      return;
    }
    void (async () => {
      try {
        const detail = await rmaApi.get(expandedCaseId);
        setExpandedCase(detail);
      } catch {
        setExpandedCase(items.find((c) => c.id === expandedCaseId) ?? null);
      }
    })();
  }, [expandedCaseId, items]);

  const searchOrders = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) {
      setOrderResults([]);
      return;
    }
    setSearchingOrders(true);
    setError("");
    try {
      const res = await rmaApi.searchShippedOrders(q);
      setOrderResults(res.items ?? []);
      if ((res.items ?? []).length === 0) {
        setError("Nenhum pedido expedido encontrado — tente número do pedido, cliente, documento ou código AAA.");
      }
    } catch (err) {
      setOrderResults([]);
      setError(err instanceof Error ? err.message : "Erro ao buscar pedidos");
    } finally {
      setSearchingOrders(false);
    }
  }, []);

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
    if (defectConfirmed) {
      setResolveById((prev) => {
        const next = { ...prev };
        for (const [id, value] of Object.entries(next)) {
          if (value === "restock") next[id] = "scrap";
        }
        return next;
      });
    }
  }, [defectConfirmed]);

  function defaultRmaResolution(c: RMACase): string {
    return c.defect_confirmed ? "scrap" : "restock";
  }

  function rmaResolutionOptions(c: RMACase): { value: string; label: string }[] {
    if (c.defect_confirmed) {
      return [
        { value: "scrap", label: "Descarte" },
        { value: "warranty", label: "Garantia fabricante" },
        { value: "refund", label: "Reembolso" },
      ];
    }
    return [
      { value: "restock", label: "Restock" },
      { value: "refund", label: "Reembolso" },
      { value: "warranty", label: "Garantia fabricante" },
    ];
  }

  useEffect(() => {
    if (!orderId) {
      setOrderItems([]);
      setOrderItemId("");
      setWarranty(null);
      setEligibleUnits(null);
      return;
    }
    void (async () => {
      setLoadingOrder(true);
      setError("");
      try {
        const { order, orderItems: lines, warranty: warrantyRes } = await rmaApi.loadOrderContext(orderId);
        setOrderItems(lines);
        setOrderItemId((prev) => {
          if (prev && lines.some((l) => l.id === prev)) return prev;
          return lines[0]?.id ?? "";
        });
        setQuantity(1);
        setWarranty(warrantyRes);
      } catch (err) {
        setOrderItems([]);
        setOrderItemId("");
        setWarranty(null);
        setEligibleUnits(null);
        setError(err instanceof Error ? err.message : "Erro ao carregar itens do pedido");
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
        const res = await rmaApi.eligibility(orderId, orderItemId);
        setEligibleUnits(res.eligible_units);
      } catch {
        setEligibleUnits(null);
      }
    })();
  }, [orderId, orderItemId]);

  const selectedLine = orderItems.find((l) => l.id === orderItemId);
  const canOpenCase =
    Boolean(orderId && selectedLine && reason.trim() && testNotes.trim() && testPhotos.length > 0)
    && (warranty?.within_warranty ?? false)
    && (eligibleUnits ?? 0) >= quantity;

  function selectOrder(order: OrderListItem) {
    setOrderId(order.id);
    setSelectedOrderLabel(`${order.order_number} — ${order.customer_name}`);
    setOrderSearch("");
    setOrderResults([]);
    if (order.matched_order_item_id) {
      setOrderItemId(order.matched_order_item_id);
    }
    if (order.matched_unit_code) {
      setInfo(`Unidade ${order.matched_unit_code} vinculada ao pedido.`);
    }
  }

  function clearSelectedOrder() {
    setOrderId("");
    setOrderItemId("");
    setOrderItems([]);
    setSelectedOrderLabel("");
    setWarranty(null);
    setEligibleUnits(null);
    setInfo("");
  }

  async function createRMA(e: FormEvent) {
    e.preventDefault();
    setInfo("");
    setError("");
    if (!selectedLine || !canOpenCase) {
      if (warranty && !warranty.within_warranty) {
        setError("Prazo de garantia expirado — não é possível abrir novo caso RMA para este pedido.");
      } else if (eligibleUnits === 0) {
        setError("Nenhuma unidade vendida elegível neste item — a peça pode já ter sido devolvida e reintegrada ao estoque.");
      } else if (eligibleUnits !== null && eligibleUnits < quantity) {
        setError(`Quantidade solicitada excede as ${eligibleUnits} unidade(s) elegível(eis).`);
      } else {
        setError("Preencha o teste, a descrição do problema e anexe ao menos uma foto de evidência.");
      }
      return;
    }
    setRmaMutationError("");
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          order_id: orderId,
          reason: reason.trim(),
          test_notes: testNotes.trim(),
          defect_confirmed: defectConfirmed,
          items: [{
            order_item_id: selectedLine.id,
            sku_id: selectedLine.sku_id,
            quantity,
          }],
        }),
      );
      testPhotos.forEach((photo, index) => {
        form.set(`test_photo_${index}`, photo.file, photo.file.name || `test-${index + 1}.jpg`);
      });
      await submitRMA(form);
      setInfo("Caso RMA aberto — aguardando aprovação após revisão do teste.");
      clearSelectedOrder();
      setReason("");
      setTestNotes("");
      setTestPhotos([]);
      setDefectConfirmed(true);
      setQuantity(1);
      await refetchCases();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao abrir RMA");
      }
    }
  }

  async function action(id: string, step: "approve" | "receive" | "resolve", resolution?: string) {
    setError("");
    const rmaCase = items.find((c) => c.id === id);
    const bodyResolution = resolution ?? (rmaCase ? defaultRmaResolution(rmaCase) : "scrap");
    try {
      await runRmaStep({
        id,
        step,
        body: step === "resolve" ? { resolution: bodyResolution } : undefined,
      });
      setInfo(`RMA ${step}${step === "resolve" ? ` (${bodyResolution})` : ""}`);
      await refetchCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na ação");
    }
  }

  function statusLabel(status: string): string {
    switch (status) {
      case "inspecting":
        return "Em teste / aguardando aprovação";
      case "approved":
        return "Aprovado — aguardando recebimento";
      case "received":
        return "Recebido — aguardando resolução";
      case "resolved":
        return "Resolvido";
      default:
        return status;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">RMA / Garantia técnica</h1>
        <p className="mt-1 text-sm text-slate-600">
          Defeito confirmado em bancada — teste, evidências fotográficas e encaminhamento (descarte ou fabricante).
          {" "}
          <Link href="/devolucoes" className="text-blue-600 hover:underline">Retorno comercial simples → Devoluções</Link>
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Abrir RMA">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={createRMA}>
          <div className="sm:col-span-2">
            <Field
              label="Buscar pedido expedido"
              hint="Número do pedido, nome do cliente, documento ou código AAA da unidade"
            >
              {orderId ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                    <span className="font-medium text-emerald-900">{selectedOrderLabel}</span>
                    <button type="button" className="text-emerald-700 underline" onClick={clearSelectedOrder}>
                      Trocar pedido
                    </button>
                  </div>
                  {warranty ? (
                    <p className={`text-xs ${warranty.within_warranty ? "text-emerald-700" : "text-red-700"}`}>
                      Garantia: {warranty.warranty_days} dias
                      {warranty.warranty_expires_at
                        ? ` · válida até ${new Date(warranty.warranty_expires_at).toLocaleDateString("pt-BR")}`
                        : ""}
                      {warranty.within_warranty ? " · dentro do prazo" : " · prazo expirado — aprovação será bloqueada"}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Ex.: PED-001020, Lucas, 4567890, AAA0142"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void searchOrders(orderSearch);
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" disabled={searchingOrders} onClick={() => void searchOrders(orderSearch)}>
                      {searchingOrders ? "Buscando…" : "Buscar"}
                    </Button>
                  </div>
                  {orderResults.length > 0 ? (
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
                      {orderResults.map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => selectOrder(o)}
                          >
                            <span className="font-mono font-medium">{o.order_number}</span>
                            {" — "}
                            {o.customer_name}
                            {o.matched_unit_code ? (
                              <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-white">
                                {o.matched_unit_code}
                              </span>
                            ) : null}
                            <span className="ml-2 text-slate-500">${o.total_usd.toFixed(2)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </Field>
          </div>

          <Field label="Item do pedido">
            <Select
              value={orderItemId}
              onChange={(e) => {
                setOrderItemId(e.target.value);
                const line = orderItems.find((l) => l.id === e.target.value);
                setQuantity(line ? Math.min(quantity, line.quantity) || 1 : 1);
              }}
              required
              disabled={!orderId || loadingOrder || orderItems.length === 0}
            >
              {loadingOrder ? <option value="">Carregando…</option> : null}
              {!loadingOrder && orderItems.length === 0 ? <option value="">Sem itens</option> : null}
              {orderItems.map((line) => (
                <option key={line.id} value={line.id}>
                  {(line.sku_code ?? line.sku_id.slice(0, 8))} · qtd {line.quantity} · ${line.line_total_usd.toFixed(2)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantidade">
            <Input
              type="number"
              min={1}
              max={selectedLine?.quantity ?? 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              disabled={!selectedLine}
            />
          </Field>

          {eligibleUnits === 0 && orderId && orderItemId ? (
            <div className="sm:col-span-2">
              <Alert tone="error">
                Nenhuma unidade vendida elegível neste item — a peça pode já ter sido devolvida e reintegrada ao estoque
                (ex.: caso RMA anterior resolvido com restock). Escolha outro pedido ou item.
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

          <div className="sm:col-span-2">
            <Field label="Descrição do problema">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Ex.: memória não é reconhecida pelo servidor" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Resultado do teste" hint="Descreva o que foi testado e o comportamento observado">
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={testNotes}
                onChange={(e) => setTestNotes(e.target.value)}
                required
                placeholder="Ex.: testado em slot 1 e 2; POST trava; LED de erro aceso…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={defectConfirmed}
                onChange={(e) => setDefectConfirmed(e.target.checked)}
              />
              Defeito confirmado no teste (peça será encaminhada para descarte, não retorna ao estoque)
            </label>
          </div>

          {warranty && !warranty.within_warranty && orderId ? (
            <div className="sm:col-span-2">
              <Alert tone="error">Prazo de garantia expirado — aprovação será bloqueada; escolha outro pedido.</Alert>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-900">Evidências fotográficas do teste</p>
            <BatchPhotoUploader photos={testPhotos} maxPhotos={5} variant="rma" onChange={setTestPhotos} />
          </div>

          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={!canOpenCase || submitting}>
              {submitting ? "Registrando…" : "Abrir caso com teste"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Casos RMA">
        <div className="mb-4">
          <Field label="Buscar casos" hint="Cliente, documento, pedido, código AAA ou número do caso (RMA-…)">
            <Input
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Ex.: RMA-000002, PED-001020, AAA0142"
            />
          </Field>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            {caseSearch.trim() ? "Nenhum caso encontrado para essa busca." : "Nenhum caso."}
          </p>
        ) : (
          <Table
            headers={["Caso", "Pedido", "Cliente", "Status", "Garantia", "Motivo", ""]}
            rows={items.map((r) => [
              <button
                key={`case-${r.id}`}
                type="button"
                className="font-mono text-blue-600 hover:underline"
                onClick={() => setExpandedCaseId(expandedCaseId === r.id ? "" : r.id)}
              >
                {r.case_number}
              </button>,
              r.order_number ?? "—",
              r.customer_name ?? "—",
              statusLabel(r.status),
              r.within_warranty ? (
                <span className="text-emerald-700">Dentro do prazo</span>
              ) : (
                <span className="text-red-700">Expirada</span>
              ),
              r.reason,
              <div key="a" className="flex flex-wrap gap-2">
                {(r.status === "inspecting" || r.status === "requested") ? (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline disabled:text-slate-400"
                    disabled={!r.within_warranty}
                    title={r.within_warranty ? "Aprovar RMA" : "Fora do prazo de garantia"}
                    onClick={() => void action(r.id, "approve")}
                  >
                    Aprovar
                  </button>
                ) : null}
                {r.status === "approved" ? (
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void action(r.id, "receive")}>
                    Receber
                  </button>
                ) : null}
                {r.status === "received" ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Select
                      value={resolveById[r.id] ?? defaultRmaResolution(r)}
                      onChange={(e) => setResolveById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    >
                      {rmaResolutionOptions(r).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => void action(r.id, "resolve", resolveById[r.id] ?? defaultRmaResolution(r))}
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
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-3 text-sm">
              <p><strong>Teste:</strong> {expandedCase.test_notes ?? "—"}</p>
              {expandedCase.defect_confirmed ? (
                <p className="text-amber-800">Defeito confirmado — resolução esperada: descarte</p>
              ) : null}
              {expandedCase.resolution ? <p><strong>Resolução:</strong> {expandedCase.resolution}</p> : null}
              {(expandedCase.test_photos ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(expandedCase.test_photos ?? []).map((photo, index) => (
                    <RMATestPhotoThumb key={photo.id} caseId={expandedCase.id} photoId={photo.id} alt={`Evidência ${index + 1}`} />
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Sem fotos de evidência.</p>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
