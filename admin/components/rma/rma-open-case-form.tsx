"use client";

import { FormEvent } from "react";
import type { OrderItem, OrderListItem } from "@/lib/types";
import type { WarrantyCheck } from "@/lib/api/rma";
import { BatchPhotoUploader, type BatchPhotoDraft } from "@/components/intake-batch-photos";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

type Props = {
  orderId: string;
  selectedOrderLabel: string;
  orderSearch: string;
  onOrderSearchChange: (value: string) => void;
  searchingOrders: boolean;
  onSearchOrders: (term: string) => void;
  orderResults: OrderListItem[];
  onSelectOrder: (order: OrderListItem) => void;
  onClearOrder: () => void;
  warranty: WarrantyCheck | null;
  orderItems: OrderItem[];
  orderItemId: string;
  onOrderItemIdChange: (id: string) => void;
  loadingOrder: boolean;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  selectedLine: OrderItem | undefined;
  eligibleUnits: number | null;
  reason: string;
  onReasonChange: (value: string) => void;
  testNotes: string;
  onTestNotesChange: (value: string) => void;
  defectConfirmed: boolean;
  onDefectConfirmedChange: (value: boolean) => void;
  testPhotos: BatchPhotoDraft[];
  onTestPhotosChange: (photos: BatchPhotoDraft[]) => void;
  canOpenCase: boolean;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function RMAOpenCaseForm({
  orderId,
  selectedOrderLabel,
  orderSearch,
  onOrderSearchChange,
  searchingOrders,
  onSearchOrders,
  orderResults,
  onSelectOrder,
  onClearOrder,
  warranty,
  orderItems,
  orderItemId,
  onOrderItemIdChange,
  loadingOrder,
  quantity,
  onQuantityChange,
  selectedLine,
  eligibleUnits,
  reason,
  onReasonChange,
  testNotes,
  onTestNotesChange,
  defectConfirmed,
  onDefectConfirmedChange,
  testPhotos,
  onTestPhotosChange,
  canOpenCase,
  submitting,
  onSubmit,
}: Props) {
  return (
    <Card title="Abrir RMA">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <div className="sm:col-span-2">
          <Field
            label="Buscar pedido expedido"
            hint="Número do pedido, nome do cliente, documento ou código AAA da unidade"
          >
            {orderId ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                  <span className="font-medium text-emerald-900">{selectedOrderLabel}</span>
                  <button type="button" className="text-emerald-700 underline" onClick={onClearOrder}>
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
                    onChange={(e) => onOrderSearchChange(e.target.value)}
                    placeholder="Ex.: PED-001020, Lucas, 4567890, AAA0142"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSearchOrders(orderSearch);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={searchingOrders}
                    onClick={() => onSearchOrders(orderSearch)}
                  >
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
                          onClick={() => onSelectOrder(o)}
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
            onChange={(e) => onOrderItemIdChange(e.target.value)}
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
            onChange={(e) => onQuantityChange(Number(e.target.value))}
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
            <Input
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              required
              placeholder="Ex.: memória não é reconhecida pelo servidor"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Resultado do teste" hint="Descreva o que foi testado e o comportamento observado">
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={testNotes}
              onChange={(e) => onTestNotesChange(e.target.value)}
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
              onChange={(e) => onDefectConfirmedChange(e.target.checked)}
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
          <BatchPhotoUploader photos={testPhotos} maxPhotos={5} variant="rma" onChange={onTestPhotosChange} />
        </div>

        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={!canOpenCase || submitting}>
            {submitting ? "Registrando…" : "Abrir caso com teste"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
