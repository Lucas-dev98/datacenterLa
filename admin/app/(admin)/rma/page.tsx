"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { useCreateRMA } from "@/hooks/use-create-rma";
import { useRmaCasesList } from "@/hooks/use-rma-cases-list";
import { useRmaStep } from "@/hooks/use-rma-step";
import { rmaApi, type RMACase, type WarrantyCheck } from "@/lib/api/rma";
import type { OrderItem, OrderListItem } from "@/lib/types";
import { defaultRmaResolution } from "@/lib/rma-resolution";
import type { BatchPhotoDraft } from "@/components/intake-batch-photos";
import { Alert } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { RMAOpenCaseForm } from "@/components/rma/rma-open-case-form";
import { RMACasesPanel } from "@/components/rma/rma-cases-panel";

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
  const toast = useToast();
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
        const { orderItems: lines, warranty: warrantyRes } = await rmaApi.loadOrderContext(orderId);
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
      toast.push(`Unidade ${order.matched_unit_code} vinculada ao pedido.`, "success");
    }
  }

  function clearSelectedOrder() {
    setOrderId("");
    setOrderItemId("");
    setOrderItems([]);
    setSelectedOrderLabel("");
    setWarranty(null);
    setEligibleUnits(null);
  }

  function onOrderItemIdChange(id: string) {
    setOrderItemId(id);
    const line = orderItems.find((l) => l.id === id);
    setQuantity(line ? Math.min(quantity, line.quantity) || 1 : 1);
  }

  async function createRMA(e: FormEvent) {
    e.preventDefault();
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
      toast.push("Caso RMA aberto — aguardando aprovação após revisão do teste.", "success");
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
      toast.push(`RMA ${step}${step === "resolve" ? ` (${bodyResolution})` : ""}`, "success");
      await refetchCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na ação");
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

      <RMAOpenCaseForm
        orderId={orderId}
        selectedOrderLabel={selectedOrderLabel}
        orderSearch={orderSearch}
        onOrderSearchChange={setOrderSearch}
        searchingOrders={searchingOrders}
        onSearchOrders={(term) => void searchOrders(term)}
        orderResults={orderResults}
        onSelectOrder={selectOrder}
        onClearOrder={clearSelectedOrder}
        warranty={warranty}
        orderItems={orderItems}
        orderItemId={orderItemId}
        onOrderItemIdChange={onOrderItemIdChange}
        loadingOrder={loadingOrder}
        quantity={quantity}
        onQuantityChange={setQuantity}
        selectedLine={selectedLine}
        eligibleUnits={eligibleUnits}
        reason={reason}
        onReasonChange={setReason}
        testNotes={testNotes}
        onTestNotesChange={setTestNotes}
        defectConfirmed={defectConfirmed}
        onDefectConfirmedChange={setDefectConfirmed}
        testPhotos={testPhotos}
        onTestPhotosChange={setTestPhotos}
        canOpenCase={canOpenCase}
        submitting={submitting}
        onSubmit={(e) => void createRMA(e)}
      />

      <RMACasesPanel
        caseSearch={caseSearch}
        onCaseSearchChange={setCaseSearch}
        items={items}
        expandedCaseId={expandedCaseId}
        onToggleCase={(id) => setExpandedCaseId(expandedCaseId === id ? "" : id)}
        expandedCase={expandedCase}
        resolveById={resolveById}
        onResolveChange={(caseId, resolution) =>
          setResolveById((prev) => ({ ...prev, [caseId]: resolution }))
        }
        onAction={(id, step, resolution) => void action(id, step, resolution)}
      />
    </div>
  );
}
