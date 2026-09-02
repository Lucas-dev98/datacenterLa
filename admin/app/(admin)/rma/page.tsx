"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRmaCasesList } from "@/hooks/use-rma-cases-list";
import { useRmaOpenCase } from "@/hooks/use-rma-open-case";
import { useRmaCasesPanel } from "@/hooks/use-rma-cases-panel";
import { Alert } from "@/components/ui";
import { RMAOpenCaseForm } from "@/components/rma/rma-open-case-form";
import { RMACasesPanel } from "@/components/rma/rma-cases-panel";

export default function RMAPage() {
  const [error, setError] = useState("");
  const onError = useCallback((message: string) => setError(message), []);
  const clearError = useCallback(() => setError(""), []);

  const [caseSearch, setCaseSearch] = useState("");
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const { data: casesData, error: listError, refetch: refetchCases } = useRmaCasesList(caseSearchTerm);
  const items = casesData ?? [];

  const openCase = useRmaOpenCase({ onError, clearError, onCaseCreated: refetchCases });
  const casesPanel = useRmaCasesPanel({
    items,
    defectConfirmed: openCase.defectConfirmed,
    onError,
    clearError,
    onRefresh: refetchCases,
  });

  useEffect(() => {
    if (listError) setError(listError);
  }, [listError]);

  useEffect(() => {
    const term = caseSearch.trim();
    const t = setTimeout(() => setCaseSearchTerm(term), term ? 300 : 0);
    return () => clearTimeout(t);
  }, [caseSearch]);

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
        orderId={openCase.orderId}
        selectedOrderLabel={openCase.selectedOrderLabel}
        orderSearch={openCase.orderSearch}
        onOrderSearchChange={openCase.setOrderSearch}
        searchingOrders={openCase.searchingOrders}
        onSearchOrders={(term) => void openCase.searchOrders(term)}
        orderResults={openCase.orderResults}
        onSelectOrder={openCase.selectOrder}
        onClearOrder={openCase.clearSelectedOrder}
        warranty={openCase.warranty}
        orderItems={openCase.orderItems}
        orderItemId={openCase.orderItemId}
        onOrderItemIdChange={openCase.onOrderItemIdChange}
        loadingOrder={openCase.loadingOrder}
        quantity={openCase.quantity}
        onQuantityChange={openCase.setQuantity}
        selectedLine={openCase.selectedLine}
        eligibleUnits={openCase.eligibleUnits}
        reason={openCase.reason}
        onReasonChange={openCase.setReason}
        testNotes={openCase.testNotes}
        onTestNotesChange={openCase.setTestNotes}
        defectConfirmed={openCase.defectConfirmed}
        onDefectConfirmedChange={openCase.setDefectConfirmed}
        testPhotos={openCase.testPhotos}
        onTestPhotosChange={openCase.setTestPhotos}
        canOpenCase={openCase.canOpenCase}
        submitting={openCase.submitting}
        onSubmit={(e) => void openCase.createRMA(e)}
      />

      <RMACasesPanel
        caseSearch={caseSearch}
        onCaseSearchChange={setCaseSearch}
        items={items}
        expandedCaseId={casesPanel.expandedCaseId}
        onToggleCase={casesPanel.toggleCase}
        expandedCase={casesPanel.expandedCase}
        resolveById={casesPanel.resolveById}
        onResolveChange={(caseId, resolution) =>
          casesPanel.setResolveById((prev) => ({ ...prev, [caseId]: resolution }))
        }
        onAction={(id, step, resolution) => void casesPanel.action(id, step, resolution)}
      />
    </div>
  );
}
