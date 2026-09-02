"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { useCreateRMA } from "@/hooks/use-create-rma";
import { rmaApi, type WarrantyCheck } from "@/lib/api/rma";
import type { OrderItem, OrderListItem } from "@/lib/types";
import type { BatchPhotoDraft } from "@/components/intake-batch-photos";
import { useToast } from "@/components/toast-provider";

type Options = {
  onError: (message: string) => void;
  clearError?: () => void;
  onCaseCreated?: () => void | Promise<unknown>;
};

export function useRmaOpenCase({ onError, clearError, onCaseCreated }: Options) {
  const toast = useToast();
  const { run: submitRMA, loading: submitting, setError: setRmaMutationError } = useCreateRMA();

  const [orderSearch, setOrderSearch] = useState("");
  const [orderResults, setOrderResults] = useState<OrderListItem[]>([]);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [testNotes, setTestNotes] = useState("");
  const [defectConfirmed, setDefectConfirmed] = useState(true);
  const [testPhotos, setTestPhotos] = useState<BatchPhotoDraft[]>([]);
  const [warranty, setWarranty] = useState<WarrantyCheck | null>(null);
  const [eligibleUnits, setEligibleUnits] = useState<number | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [selectedOrderLabel, setSelectedOrderLabel] = useState("");

  const searchOrders = useCallback(
    async (term: string) => {
      const q = term.trim();
      if (!q) {
        setOrderResults([]);
        return;
      }
      setSearchingOrders(true);
      clearError?.();
      try {
        const res = await rmaApi.searchShippedOrders(q);
        setOrderResults(res.items ?? []);
        if ((res.items ?? []).length === 0) {
          onError("Nenhum pedido expedido encontrado — tente número do pedido, cliente, documento ou código AAA.");
        }
      } catch (err) {
        setOrderResults([]);
        onError(err instanceof Error ? err.message : "Erro ao buscar pedidos");
      } finally {
        setSearchingOrders(false);
      }
    },
    [clearError, onError],
  );

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
    if (!orderId) {
      setOrderItems([]);
      setOrderItemId("");
      setWarranty(null);
      setEligibleUnits(null);
      return;
    }
    void (async () => {
      setLoadingOrder(true);
      clearError?.();
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
        onError(err instanceof Error ? err.message : "Erro ao carregar itens do pedido");
      } finally {
        setLoadingOrder(false);
      }
    })();
  }, [orderId, clearError, onError]);

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
    clearError?.();
    if (!selectedLine || !canOpenCase) {
      if (warranty && !warranty.within_warranty) {
        onError("Prazo de garantia expirado — não é possível abrir novo caso RMA para este pedido.");
      } else if (eligibleUnits === 0) {
        onError("Nenhuma unidade vendida elegível neste item — a peça pode já ter sido devolvida e reintegrada ao estoque.");
      } else if (eligibleUnits !== null && eligibleUnits < quantity) {
        onError(`Quantidade solicitada excede as ${eligibleUnits} unidade(s) elegível(eis).`);
      } else {
        onError("Preencha o teste, a descrição do problema e anexe ao menos uma foto de evidência.");
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
      await onCaseCreated?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        onError(err.message);
      } else {
        onError(err instanceof Error ? err.message : "Erro ao abrir RMA");
      }
    }
  }

  return {
    orderId,
    selectedOrderLabel,
    orderSearch,
    setOrderSearch,
    searchingOrders,
    searchOrders,
    orderResults,
    selectOrder,
    clearSelectedOrder,
    warranty,
    orderItems,
    orderItemId,
    onOrderItemIdChange,
    loadingOrder,
    quantity,
    setQuantity,
    selectedLine,
    eligibleUnits,
    reason,
    setReason,
    testNotes,
    setTestNotes,
    defectConfirmed,
    setDefectConfirmed,
    testPhotos,
    setTestPhotos,
    canOpenCase,
    submitting,
    createRMA,
  };
}
