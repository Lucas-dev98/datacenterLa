"use client";

import { useEffect, useRef, useState } from "react";
import { printHTML } from "@/lib/api/client";
import { posApi } from "@/lib/api/pos";
import type { Order } from "@/lib/types";
import { useToast } from "@/components/toast-provider";

type Options = {
  lastOrder: Order | null;
  onError: (message: string) => void;
  clearError?: () => void;
};

export function usePdvReceipt({ lastOrder, onError, clearError }: Options) {
  const toast = useToast();
  const [receiptHtml, setReceiptHtml] = useState("");
  const [printing, setPrinting] = useState(false);
  const [saleSummary, setSaleSummary] = useState("");
  const autoPrintReceiptRef = useRef(false);

  async function loadReceiptHtml(orderId: string) {
    const html = await posApi.orderReceiptHtml(orderId);
    if (!html.trim()) {
      throw new Error("Comprovante vazio");
    }
    setReceiptHtml(html);
    return html;
  }

  useEffect(() => {
    if (!lastOrder) {
      setReceiptHtml("");
      autoPrintReceiptRef.current = false;
      return;
    }
    let cancelled = false;
    void loadReceiptHtml(lastOrder.id)
      .then((html) => {
        if (cancelled) return;
        if (autoPrintReceiptRef.current) {
          autoPrintReceiptRef.current = false;
          if (!printHTML(html)) {
            toast.push(
              "Comprovante abaixo — use Imprimir comprovante ou o botão no preview.",
              "info",
            );
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : "Erro ao carregar comprovante");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lastOrder?.id, onError, toast]);

  async function printReceipt(orderId?: string) {
    if (!lastOrder && !orderId) return;
    setPrinting(true);
    clearError?.();
    try {
      const id = orderId ?? lastOrder!.id;
      const html = receiptHtml || (await loadReceiptHtml(id));
      if (!printHTML(html)) {
        onError("Pop-up bloqueado — use o preview abaixo e o botão Imprimir comprovante.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao abrir comprovante");
    } finally {
      setPrinting(false);
    }
  }

  function resetReceipt() {
    setReceiptHtml("");
    setSaleSummary("");
    autoPrintReceiptRef.current = false;
  }

  function markAutoPrint() {
    autoPrintReceiptRef.current = true;
  }

  return {
    receiptHtml,
    printing,
    saleSummary,
    setSaleSummary,
    printReceipt,
    resetReceipt,
    markAutoPrint,
  };
}
