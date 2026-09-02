"use client";

import { FormEvent } from "react";
import type { ExchangeRatesToday } from "@/lib/api/pos";
import type { Customer } from "@/lib/types";
import { customerProfileLabel } from "@/lib/customer-profile";
import { PARAGUAY_IVA_LABEL } from "@/lib/paraguay-tax";
import { Button, Card, Field, Input } from "@/components/ui";
import type { PdvBuyerProfile } from "@/components/pdv/pdv-customer-step";

type Props = {
  profile: PdvBuyerProfile;
  selectedCustomer: Customer | null;
  walkIn: Customer | null;
  profileFallback?: string;
  chargesIVA: boolean;
  subtotalNet: number;
  ivaAmount: number;
  subtotal: number;
  discount: number;
  total: number;
  totalBRL: number | null;
  exchangeRates: ExchangeRatesToday | null;
  discountPct: string;
  onDiscountPctChange: (value: string) => void;
  shipImmediately: boolean;
  onShipImmediatelyChange: (value: boolean) => void;
  submitting: boolean;
  cartEmpty: boolean;
  pixOpen: boolean;
  canFinalize: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function PDVCheckoutPanel({
  profile,
  selectedCustomer,
  walkIn,
  profileFallback,
  chargesIVA,
  subtotalNet,
  ivaAmount,
  subtotal,
  discount,
  total,
  totalBRL,
  exchangeRates,
  discountPct,
  onDiscountPctChange,
  shipImmediately,
  onShipImmediatelyChange,
  submitting,
  cartEmpty,
  pixOpen,
  canFinalize,
  onSubmit,
}: Props) {
  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <Card title="3. Pagamento">
        <form className="space-y-4" onSubmit={onSubmit}>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {profile === "walkin" || !selectedCustomer || selectedCustomer.id === walkIn?.id
              ? profile === "walkin"
                ? "Consumidor final"
                : "Identifique o cliente para finalizar"
              : `${selectedCustomer.name} · ${customerProfileLabel(selectedCustomer, walkIn?.id, profileFallback)}`}
          </p>
          {chargesIVA ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Cliente paraguaio — preços incluem IVA ({PARAGUAY_IVA_LABEL}).
            </div>
          ) : null}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <p className="font-medium">PIX — QR Code dinâmico</p>
            <p className="mt-1 text-emerald-800">
              O valor em reais usa a cotação do dia
              {totalBRL != null
                ? `: R$ ${totalBRL.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : ""}
              . Após o cliente pagar, confirme o recebimento no modal.
            </p>
          </div>
          <Field label="Desconto %">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discountPct}
              onChange={(e) => onDiscountPctChange(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={shipImmediately}
              onChange={(e) => onShipImmediatelyChange(e.target.checked)}
            />
            Entregar na hora (baixa estoque imediata)
          </label>

          <div className="rounded-lg bg-slate-50 p-4">
            {chargesIVA ? (
              <div className="mb-2 flex justify-between text-sm text-slate-600">
                <span>Subtotal s/ IVA</span>
                <span>${subtotalNet.toFixed(2)}</span>
              </div>
            ) : null}
            {chargesIVA ? (
              <div className="mb-2 flex justify-between text-sm text-slate-600">
                <span>IVA ({PARAGUAY_IVA_LABEL})</span>
                <span>${ivaAmount.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm text-slate-600">
              <span>{chargesIVA ? "Subtotal c/ IVA" : "Subtotal"}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 ? (
              <div className="mt-1 flex justify-between text-sm text-slate-600">
                <span>Desconto ({discount}%)</span>
                <span>-${(subtotal - total).toFixed(2)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between text-lg font-semibold text-slate-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            {total > 0 && exchangeRates?.rates ? (
              <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                {exchangeRates.rates
                  .filter((q) => q.to_currency !== "USD")
                  .map((q) => (
                    <div key={q.to_currency} className="flex justify-between">
                      <span>{q.to_currency}</span>
                      <span>
                        {q.symbol}{" "}
                        {q.to_currency === "BRL"
                          ? (total * q.rate).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : Math.round(total * q.rate).toLocaleString("es-PY")}
                      </span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={submitting || cartEmpty || pixOpen || !canFinalize}
            className="w-full"
          >
            {submitting
              ? "Processando…"
              : totalBRL != null
                ? `Gerar QR PIX · R$ ${totalBRL.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "Gerar QR PIX"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
