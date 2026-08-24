"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { Customer, ExchangeRatesToday, Order, ResolvedPrice, SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { PDVExchangeRatesPanel } from "@/components/pdv-exchange-rates";
import { PDVPixModal, type POSPixInitResponse } from "@/components/pdv-pix-modal";

type Availability = {
  sku_id: string;
  qty_available: number;
};

type CartLine = {
  sku_id: string;
  code: string;
  name: string;
  unit_price_usd: number;
  price_pyg?: number;
  qty_available: number;
  quantity: number;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "card", label: "Cartão" },
  { value: "pix", label: "PIX" },
  { value: "transfer", label: "Transferência" },
] as const;

export default function PDVPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SKU[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [walkIn, setWalkIn] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [shipImmediately, setShipImmediately] = useState(true);
  const [discountPct, setDiscountPct] = useState("0");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesToday | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [pixSession, setPixSession] = useState<POSPixInitResponse | null>(null);

  useEffect(() => {
    void Promise.all([
      api<Customer>("/api/v1/sales/pos/walk-in-customer"),
      api<{ items: Customer[] }>("/api/v1/sales/customers?active_only=true"),
      api<ExchangeRatesToday>("/api/v1/sales/pos/exchange-rates"),
    ])
      .then(([walkInCustomer, custRes, rates]) => {
        setWalkIn(walkInCustomer);
        setCustomerId(walkInCustomer.id);
        setCustomers(custRes.items ?? []);
        setExchangeRates(rates);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao iniciar PDV"))
      .finally(() => setRatesLoading(false));
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unit_price_usd * line.quantity, 0),
    [cart],
  );

  const discount = parseFloat(discountPct) || 0;
  const total = useMemo(() => subtotal * (1 - discount / 100), [subtotal, discount]);

  const loadProductMeta = useCallback(async (sku: SKU): Promise<CartLine | null> => {
    try {
      const [price, avail] = await Promise.all([
        api<ResolvedPrice>(`/api/v1/pricing/skus/${sku.id}/resolve?channel=b2c`),
        api<Availability>(
          `/api/v1/stock/availability?sku_id=${sku.id}&warehouse_id=${DEFAULT_WAREHOUSE_ID}`,
        ),
      ]);
      if (avail.qty_available <= 0) {
        setError(`Sem estoque para ${sku.code}`);
        return null;
      }
      return {
        sku_id: sku.id,
        code: sku.code,
        name: sku.name,
        unit_price_usd: price.base_price_usd,
        price_pyg: price.price_pyg,
        qty_available: avail.qty_available,
        quantity: 1,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar produto");
      return null;
    }
  }, []);

  const addToCart = useCallback(
    async (sku: SKU) => {
      setError("");
      const existing = cart.find((l) => l.sku_id === sku.id);
      if (existing) {
        if (existing.quantity >= existing.qty_available) {
          setError(`Estoque insuficiente para ${sku.code}`);
          return;
        }
        setCart((prev) =>
          prev.map((l) => (l.sku_id === sku.id ? { ...l, quantity: l.quantity + 1 } : l)),
        );
        return;
      }
      const line = await loadProductMeta(sku);
      if (line) {
        setCart((prev) => [...prev, line]);
        setQuery("");
        setSearchResults([]);
        searchRef.current?.focus();
      }
    },
    [cart, loadProductMeta],
  );

  const searchProducts = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      setError("");
      try {
        const byCode = await api<SKU>(`/api/v1/pim/skus/code/${encodeURIComponent(term)}`).catch(
          () => null,
        );
        if (byCode?.is_active) {
          setSearchResults([byCode]);
          return;
        }
        const res = await api<{ items: SKU[] }>(
          `/api/v1/pim/skus?q=${encodeURIComponent(term)}&active_only=true&limit=15`,
        );
        setSearchResults(res.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro na busca");
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => void searchProducts(query), 250);
    return () => clearTimeout(t);
  }, [query, searchProducts]);

  function updateQty(skuId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.sku_id !== skuId) return l;
          const q = Math.max(1, Math.min(quantity, l.qty_available));
          return { ...l, quantity: q };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(skuId: string) {
    setCart((prev) => prev.filter((l) => l.sku_id !== skuId));
  }

  const brlRate = useMemo(
    () => exchangeRates?.rates?.find((q) => q.to_currency === "BRL")?.rate ?? null,
    [exchangeRates],
  );
  const totalBRL = brlRate != null ? total * brlRate : null;

  function resetSale() {
    setCart([]);
    setLastOrder(null);
    setPaymentRef("");
    setDiscountPct("0");
    setCustomerId(walkIn?.id ?? "");
    setInfo("");
    setError("");
    setPixSession(null);
    searchRef.current?.focus();
  }

  async function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchResults.length === 1) {
      await addToCart(searchResults[0]);
    } else if (searchResults.length > 1) {
      await addToCart(searchResults[0]);
    }
  }

  async function finalizeSale(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Adicione pelo menos um produto");
      return;
    }
    setSubmitting(true);
    setError("");
    setInfo("");
    try {
      if (paymentMethod === "pix") {
        const pix = await api<POSPixInitResponse>("/api/v1/sales/pos/pix/init", {
          method: "POST",
          body: JSON.stringify({
            customer_id: customerId || undefined,
            warehouse_id: DEFAULT_WAREHOUSE_ID,
            items: cart.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
            discount_pct: discount,
          }),
        });
        setPixSession(pix);
        setCart([]);
        return;
      }

      const order = await api<Order>("/api/v1/sales/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId || undefined,
          warehouse_id: DEFAULT_WAREHOUSE_ID,
          items: cart.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
          payment: {
            amount_usd: total,
            method: paymentMethod,
            reference: paymentRef.trim() || undefined,
          },
          ship_immediately: shipImmediately,
          discount_pct: discount,
        }),
      });
      setLastOrder(order);
      setCart([]);
      setInfo(
        shipImmediately
          ? `Venda ${order.order_number} concluída — cliente retira na hora`
          : `Venda ${order.order_number} registrada — pedido na fila de expedição`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar venda");
    } finally {
      setSubmitting(false);
    }
  }

  function onPixConfirmed(order: Order) {
    setPixSession(null);
    setLastOrder(order);
    setPaymentRef("");
    setInfo(
      shipImmediately
        ? `Venda ${order.order_number} concluída via PIX — cliente retira na hora`
        : `Venda ${order.order_number} registrada via PIX — pedido na fila de expedição`,
    );
  }

  function onPixCancelled() {
    setPixSession(null);
    setInfo("Venda PIX cancelada — estoque liberado.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/vendas" className="hover:underline">
              Vendas
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">PDV — Loja física</h1>
          <p className="mt-1 text-sm text-slate-600">
            Venda balcão com preço B2C, pagamento e baixa de estoque.
          </p>
        </div>
        {lastOrder ? (
          <div className="flex gap-2">
            <Link href={`/pedidos/${lastOrder.id}`}>
              <Button type="button" variant="secondary">
                Ver pedido {lastOrder.order_number}
              </Button>
            </Link>
            <Button type="button" onClick={resetSale}>
              Nova venda
            </Button>
          </div>
        ) : null}
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <PDVExchangeRatesPanel data={exchangeRates} loading={ratesLoading} totalUsd={total} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title="Buscar produto">
            <form onSubmit={onSearchSubmit}>
              <Input
                inputRef={searchRef}
                autoFocus
                placeholder="Código, nome ou leitor de código de barras…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {searching ? (
                <p className="text-sm text-slate-500">Buscando…</p>
              ) : query && searchResults.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum SKU encontrado.</p>
              ) : (
                searchResults.map((sku) => (
                  <button
                    key={sku.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => void addToCart(sku)}
                  >
                    <span>
                      <span className="font-mono font-medium">{sku.code}</span>
                      <span className="mx-2 text-slate-400">·</span>
                      {sku.name}
                    </span>
                    <span className="text-blue-600">+ Adicionar</span>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card title={`Carrinho (${cart.length})`}>
            {cart.length === 0 ? (
              <p className="text-sm text-slate-500">Escaneie ou busque produtos para iniciar.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => (
                  <div
                    key={line.sku_id}
                    className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium">{line.code}</p>
                      <p className="truncate text-sm text-slate-600">{line.name}</p>
                      <p className="text-xs text-slate-500">
                        USD {line.unit_price_usd.toFixed(2)}
                        {line.price_pyg ? ` · ₲ ${Math.round(line.price_pyg).toLocaleString("es-PY")}` : ""}
                        {" · "}disp. {line.qty_available}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={line.qty_available}
                      className="w-20"
                      value={line.quantity}
                      onChange={(e) => updateQty(line.sku_id, parseInt(e.target.value, 10) || 1)}
                    />
                    <p className="w-24 text-right font-medium">
                      ${(line.unit_price_usd * line.quantity).toFixed(2)}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => removeLine(line.sku_id)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title="Cliente">
            <Field label="Cliente da venda">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {walkIn ? (
                  <option value={walkIn.id}>
                    {walkIn.name} (padrão balcão)
                  </option>
                ) : null}
                {customers
                  .filter((c) => c.id !== walkIn?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </Select>
            </Field>
          </Card>

          <Card title="Pagamento">
            <form className="space-y-4" onSubmit={finalizeSale}>
              <Field label="Forma de pagamento">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {paymentMethod === "pix" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                  <p className="font-medium">PIX — QR Code dinâmico</p>
                  <p className="mt-1 text-emerald-800">
                    O valor em reais usa a cotação do dia
                    {totalBRL != null
                      ? `: R$ ${totalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : ""}
                    . Após o cliente pagar, confirme o recebimento no modal.
                  </p>
                </div>
              ) : (
                <Field label="Referência (opcional)" hint="NSU, comprovante, etc.">
                  <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </Field>
              )}
              <Field label="Desconto %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={shipImmediately}
                  onChange={(e) => setShipImmediately(e.target.checked)}
                />
                Entregar na hora (baixa estoque imediata)
              </label>

              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
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
              </div>

              <Button type="submit" disabled={submitting || cart.length === 0 || pixSession != null} className="w-full">
                {submitting
                  ? "Processando…"
                  : paymentMethod === "pix"
                    ? totalBRL != null
                      ? `Gerar QR PIX · R$ ${totalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "Gerar QR PIX"
                    : `Finalizar venda · $${total.toFixed(2)}`}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {pixSession ? (
        <PDVPixModal
          data={pixSession}
          shipImmediately={shipImmediately}
          onConfirmed={onPixConfirmed}
          onCancelled={onPixCancelled}
        />
      ) : null}
    </div>
  );
}
