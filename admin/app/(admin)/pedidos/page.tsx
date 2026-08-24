"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OrderListItem } from "@/lib/types";
import { orderChannelLabel } from "@/lib/order-channels";
import { Alert, Card, Select, Table } from "@/components/ui";

export default function PedidosPage() {
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const q = status ? `&status=${encodeURIComponent(status)}` : "";
        const res = await api<{ items: OrderListItem[]; total: number }>(
          `/api/v1/sales/orders?limit=50${q}`,
        );
        setItems(res.items);
        setTotal(res.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [status]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Pedidos</h1>
        <p className="mt-1 text-sm text-slate-600">
          {total} pedido(s) · confirmação, pagamento e expedição
        </p>
      </header>

      <Card title="Filtros">
        <Select className="max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="confirmed">Confirmado</option>
          <option value="paid">Pago</option>
          <option value="picking">Separação</option>
          <option value="shipped">Expedido</option>
          <option value="delivered">Entregue</option>
          <option value="cancelled">Cancelado</option>
        </Select>
      </Card>

      <Card title="Lista">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum pedido encontrado.</p>
        ) : (
          <Table
            headers={["Número", "Cliente", "Status", "Origem", "Total", "Data", ""]}
            rows={items.map((o) => [
              <span key="n" className="font-mono font-medium">{o.order_number}</span>,
              o.customer_name,
              o.status,
              orderChannelLabel(o.channel),
              `$${o.total_usd.toFixed(2)}`,
              new Date(o.created_at).toLocaleDateString("pt-BR"),
              <Link key="l" href={`/pedidos/${o.id}`} className="text-blue-600 hover:underline">
                Ver
              </Link>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
