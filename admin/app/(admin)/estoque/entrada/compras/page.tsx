"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Alert, Button, Card, Table } from "@/components/ui";

type PO = {
  id: string;
  po_number: string;
  supplier_name?: string;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  ordered: "Aguardando recebimento",
  partial: "Recebimento parcial",
};

export default function EntradaComprasPage() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ordered, partial] = await Promise.all([
        api<{ items: PO[] }>("/api/v1/purchases/orders?status=ordered"),
        api<{ items: PO[] }>("/api/v1/purchases/orders?status=partial"),
      ]);
      const merged = [...(ordered.items ?? []), ...(partial.items ?? [])];
      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setOrders(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar POs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
            Ordens de compra aguardando recebimento físico. Após receber, processe na fila de recebimento.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/compras">
            <Button type="button" variant="secondary">
              Nova PO
            </Button>
          </Link>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
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
          <Table
            headers={["PO", "Fornecedor", "Status", "Criada", ""]}
            rows={orders.map((po) => [
              <span key={`n-${po.id}`} className="font-mono font-medium">
                {po.po_number}
              </span>,
              po.supplier_name ?? "—",
              STATUS_LABEL[po.status] ?? po.status,
              new Date(po.created_at).toLocaleString("pt-BR"),
              <span key={`a-${po.id}`} className="flex gap-2">
                <Link href={`/compras/${po.id}`} className="text-sm text-blue-600 hover:underline">
                  Receber mercadoria
                </Link>
              </span>,
            ])}
          />
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
