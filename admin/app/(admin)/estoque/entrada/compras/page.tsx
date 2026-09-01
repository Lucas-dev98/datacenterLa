"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApiQueryFn } from "@/hooks/use-api-query";
import { purchasesApi, type PurchaseOrderSummary } from "@/lib/api/stock";
import { Alert, Button, Card, Table } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  ordered: "Aguardando recebimento",
  partial: "Recebimento parcial",
};

export default function EntradaComprasPage() {
  const router = useRouter();
  const fetchOrders = useCallback(() => purchasesApi.listPendingReceiveOrders(), []);
  const { data, error, loading, refetch } = useApiQueryFn(fetchOrders);
  const orders = data ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);

  useEffect(() => {
    setSelected(new Set());
    lastClickedIndex.current = null;
  }, [data]);

  const selectedIndices = new Set(
    orders.map((po, index) => (selected.has(po.id) ? index : -1)).filter((i) => i >= 0),
  );
  const selectedOrders = orders.filter((po) => selected.has(po.id));
  const allSelected = orders.length > 0 && selected.size === orders.length;

  function openReceive(poId: string) {
    router.push(`/estoque/entrada/compras/${poId}/receber`);
  }

  function toggleOne(index: number, event: React.MouseEvent) {
    const po = orders[index];
    if (!po) return;

    if (event.shiftKey && lastClickedIndex.current != null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(orders[i].id);
        }
        return next;
      });
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(po.id)) next.delete(po.id);
      else next.add(po.id);
      return next;
    });
    lastClickedIndex.current = index;
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      lastClickedIndex.current = null;
      return;
    }
    setSelected(new Set(orders.map((po) => po.id)));
  }

  function receiveSelected() {
    if (selectedOrders.length !== 1) return;
    openReceive(selectedOrders[0].id);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/estoque/entrada" className="hover:underline">
              Entrada
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Receber compra (PO)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Clique na linha para selecionar (Shift+clique para intervalo). Duplo clique abre o recebimento.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/compras">
            <Button type="button" variant="secondary">
              Nova PO
            </Button>
          </Link>
          <Button type="button" variant="secondary" onClick={() => void refetch()} disabled={loading}>
            Atualizar
          </Button>
        </div>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma PO aguardando recebimento. Crie uma em{" "}
            <Link href="/compras" className="text-blue-600 hover:underline">
              Compras
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={selectedOrders.length !== 1}
                onClick={receiveSelected}
              >
                Receber mercadoria
                {selectedOrders.length === 1 ? ` (${selectedOrders[0].po_number})` : ""}
              </Button>
              {selected.size > 1 ? (
                <p className="text-sm text-slate-500">
                  {selected.size} selecionadas — escolha uma para receber ou dê duplo clique na linha.
                </p>
              ) : selected.size === 1 ? (
                <p className="text-sm text-slate-500">1 selecionada</p>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma selecionada</p>
              )}
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={toggleAll}
              >
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            </div>

            <Table
              headers={[
                <input
                  key="all"
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Selecionar todas as POs"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAll();
                  }}
                  readOnly
                />,
                "PO",
                "Fornecedor",
                "Status",
                "Criada",
              ]}
              rows={orders.map((po: PurchaseOrderSummary, index: number) => [
                <input
                  key={`cb-${po.id}`}
                  type="checkbox"
                  checked={selected.has(po.id)}
                  readOnly
                  aria-label={`Selecionar ${po.po_number}`}
                />,
                <span key={`n-${po.id}`} className="font-mono font-medium text-slate-900">
                  {po.po_number}
                </span>,
                po.supplier_name ?? "—",
                STATUS_LABEL[po.status] ?? po.status,
                new Date(po.created_at).toLocaleString("pt-BR"),
              ])}
              selectedRowIndices={selectedIndices}
              onRowClick={toggleOne}
              onRowDoubleClick={(index, event) => {
                event.preventDefault();
                const po = orders[index];
                if (po) openReceive(po.id);
              }}
            />
          </>
        )}
      </Card>

      <p className="text-sm text-slate-500">
        Depois de receber a PO, as unidades vão para{" "}
        <Link href="/estoque/entrada/recebimento" className="text-blue-600 hover:underline">
          Fila de recebimento
        </Link>
        .
      </p>
    </div>
  );
}
