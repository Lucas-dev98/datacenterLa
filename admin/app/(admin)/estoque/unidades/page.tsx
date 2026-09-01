"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { stockApi } from "@/lib/api/stock";
import type { InventoryUnitDetail } from "@/lib/types";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  received: "Recebido (fila)",
  inspecting: "Em inspeção",
  identified: "Identificado",
  available: "Disponível",
  reserved: "Reservado (pedido)",
  picking: "Em separação",
  sold: "Vendido / expedido",
  returned: "Devolvido",
  damaged: "Avariado",
};

const STATUS_BADGE: Record<string, string> = {
  received: "bg-amber-100 text-amber-900",
  inspecting: "bg-amber-100 text-amber-900",
  identified: "bg-sky-100 text-sky-900",
  available: "bg-emerald-100 text-emerald-900",
  reserved: "bg-violet-100 text-violet-900",
  picking: "bg-violet-100 text-violet-900",
  sold: "bg-slate-200 text-slate-800",
  returned: "bg-orange-100 text-orange-900",
  damaged: "bg-red-100 text-red-900",
};

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function EstoqueUnidadesPage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState<InventoryUnitDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const searchByCode = useCallback(async (term: string) => {
    const normalized = term.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true);
    setError("");
    setUnit(null);
    try {
      const u = await stockApi.unitDetailByCode(normalized);
      setUnit(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unidade não encontrada");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (fromUrl) {
      setCode(fromUrl);
      void searchByCode(fromUrl);
    }
  }, [searchParams, searchByCode]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await searchByCode(code);
  }

  const status = unit?.status ?? "";
  const statusLabel = STATUS_LABEL[status] ?? status;
  const statusBadge = STATUS_BADGE[status] ?? "bg-slate-100 text-slate-700";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          <Link href="/estoque/posicao" className="hover:underline">
            Posição
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Consulta de unidade</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cada peça física tem um código AAA único — escaneie ou digite para ver qual produto é e o status atual.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card title="Buscar unidade">
        <form className="flex flex-wrap gap-3" onSubmit={onSearch}>
          <Field label="Código AAA">
            <Input
              className="font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AAA0001"
              autoFocus
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={loading || !code.trim()}>
              Consultar
            </Button>
          </div>
        </form>
      </Card>

      {unit ? (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="font-mono text-lg font-semibold text-slate-900">{unit.unit_code}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{unit.product_name}</h2>
                {unit.product_description ? (
                  <p className="mt-1 text-sm text-slate-600">{unit.product_description}</p>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge}`}>
                {statusLabel}
              </span>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">SKU</dt>
                <dd className="font-medium">
                  <span className="font-mono">{unit.sku_code}</span>
                  {unit.sku_name ? (
                    <span className="mt-0.5 block text-slate-600">{unit.sku_name}</span>
                  ) : null}
                </dd>
              </div>
              {unit.brand ? (
                <div>
                  <dt className="text-slate-500">Marca</dt>
                  <dd className="font-medium">{unit.brand}</dd>
                </div>
              ) : null}
              {unit.category_name ? (
                <div>
                  <dt className="text-slate-500">Categoria</dt>
                  <dd className="font-medium">{unit.category_name}</dd>
                </div>
              ) : null}
              {unit.serial_number ? (
                <div>
                  <dt className="text-slate-500">Nº de série</dt>
                  <dd className="font-mono">{unit.serial_number}</dd>
                </div>
              ) : null}
              {unit.unit_cost_usd != null ? (
                <div>
                  <dt className="text-slate-500">Custo USD</dt>
                  <dd>{unit.unit_cost_usd.toFixed(2)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">Recebido em</dt>
                <dd>{formatDateTime(unit.received_at)}</dd>
              </div>
              {unit.available_at ? (
                <div>
                  <dt className="text-slate-500">Disponível desde</dt>
                  <dd>{formatDateTime(unit.available_at)}</dd>
                </div>
              ) : null}
              {unit.sold_at ? (
                <div>
                  <dt className="text-slate-500">Expedido / vendido em</dt>
                  <dd>{formatDateTime(unit.sold_at)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <Link href={`/produtos/${unit.product_id}`}>
                <Button type="button" variant="secondary">
                  Ver produto
                </Button>
              </Link>
              <Link href={`/estoque/movimentacoes?q=${encodeURIComponent(unit.unit_code)}`}>
                <Button type="button" variant="secondary">
                  Histórico de movimentações
                </Button>
              </Link>
              {unit.order_id ? (
                <Link href={`/pedidos/${unit.order_id}`}>
                  <Button type="button" variant="secondary">
                    Ver pedido
                  </Button>
                </Link>
              ) : null}
              {unit.purchase_id ? (
                <Link href={`/compras/${unit.purchase_id}`}>
                  <Button type="button" variant="secondary">
                    {unit.po_number ? `PO ${unit.po_number}` : "Ver compra"}
                  </Button>
                </Link>
              ) : null}
            </div>

            {["received", "inspecting", "identified"].includes(status) ? (
              <Alert tone="warning">
                Esta unidade está na fila de recebimento.{" "}
                <Link href="/estoque/entrada/recebimento" className="font-medium text-blue-700 hover:underline">
                  Ir para recebimento
                </Link>
              </Alert>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
