"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUpdateSupplierReturnStatus } from "@/hooks/use-supplier-return-mutations";
import { stockApi, type SupplierReturn } from "@/lib/api/stock";
import { Alert, Button, Card, Table } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  sent: "Enviada ao fornecedor",
  closed: "Encerrada",
  cancelled: "Cancelada",
};

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "sent", label: "Enviadas" },
  { value: "closed", label: "Encerradas" },
  { value: "cancelled", label: "Canceladas" },
];

export default function DevolucoesFornecedorPage() {
  const [items, setItems] = useState<SupplierReturn[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const { run: updateStatus, loading: updating } = useUpdateSupplierReturnStatus();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await stockApi.listSupplierReturns(statusFilter || undefined);
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(id: string, status: "sent" | "closed" | "cancelled") {
    setPendingId(id);
    setError("");
    setInfo("");
    try {
      await updateStatus({ id, status });
      setInfo(`Devolução atualizada: ${STATUS_LABEL[status] ?? status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setPendingId(null);
    }
  }

  function actionsFor(item: SupplierReturn) {
    const busy = updating && pendingId === item.id;
    if (item.status === "open") {
      return (
        <span className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void changeStatus(item.id, "sent")}>
            Marcar enviada
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void changeStatus(item.id, "cancelled")}
          >
            Cancelar
          </Button>
        </span>
      );
    }
    if (item.status === "sent") {
      return (
        <Button type="button" disabled={busy} onClick={() => void changeStatus(item.id, "closed")}>
          Encerrar
        </Button>
      );
    }
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/estoque/entrada" className="hover:underline">
              Entrada
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Devoluções ao fornecedor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Unidades reprovadas no teste de recebimento — acompanhe envio e encerramento com o fornecedor.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === f.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma devolução registrada.</p>
        ) : (
          <Table
            headers={["Unidade", "SKU", "PO", "Fornecedor", "Motivo", "Status", "Criada", ""]}
            rows={items.map((r) => [
              r.unit_code ?? "—",
              r.sku_code ?? "—",
              r.po_number ?? "—",
              r.supplier_name ?? "—",
              r.reason,
              STATUS_LABEL[r.status] ?? r.status,
              new Date(r.created_at).toLocaleString("pt-BR"),
              actionsFor(r),
            ])}
          />
        )}
      </Card>
    </div>
  );
}
