"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { printHTML } from "@/lib/api";
import { posApi, type ExchangeRatesToday, type POSPixInitResponse } from "@/lib/api/pos";
import { pricingApi } from "@/lib/api/pricing";
import { stockApi } from "@/lib/api/stock";
import { pimApi } from "@/lib/api/pim";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { Customer, Order, SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { PDVExchangeRatesPanel } from "@/components/pdv-exchange-rates";
import { PDVPixModal } from "@/components/pdv-pix-modal";
import { PDVCustomerModal } from "@/components/pdv-customer-modal";
import { customerMatchesQuery, customerProfileLabel, digitsOnly, documentTypeLabel } from "@/lib/customer-profile";
import { paraguayanBuyerKindLabel } from "@/lib/paraguay-documents";
import { PARAGUAY_IVA_LABEL, paraguayIVAFromNet } from "@/lib/paraguay-tax";

type Availability = {
  sku_id: string;
  qty_available: number;
};

type CartLine = {
  sku_id: string;
  code: string;
  name: string;
  base_price_usd: number;
  price_with_iva_usd: number;
  price_pyg?: number;
  price_with_iva_pyg?: number;
  qty_available: number;
  quantity: number;
};

function lineUnitUsd(line: CartLine, withIVA: boolean) {
  return withIVA ? line.price_with_iva_usd : line.base_price_usd;
}


export default function PDVPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SKU[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [walkIn, setWalkIn] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [shipImmediately, setShipImmediately] = useState(true);
  const [discountPct, setDiscountPct] = useState("0");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesToday | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [pixSession, setPixSession] = useState<POSPixInitResponse | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [printing, setPrinting] = useState(false);
  const [profile, setProfile] = useState<"walkin" | "paraguayan" | "foreigner">("walkin");
  const [lastCustomer, setLastCustomer] = useState<Customer | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState("");
  const autoPrintReceiptRef = useRef(false);

  useEffect(() => {
    void Promise.all([posApi.getWalkInCustomer(), posApi.getExchangeRates()])
      .then(([walkInCustomer, rates]) => {
        setWalkIn(walkInCustomer);
        setCustomerId(walkInCustomer.id);
        setExchangeRates(rates);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao iniciar PDV"))
      .finally(() => setRatesLoading(false));
  }, []);

  const chargesIVA = profile === "paraguayan";

  const subtotalNet = useMemo(
    () => cart.reduce((sum, line) => sum + line.base_price_usd * line.quantity, 0),
    [cart],
  );

  const ivaAmount = useMemo(
    () => (chargesIVA ? paraguayIVAFromNet(subtotalNet) : 0),
    [chargesIVA, subtotalNet],
  );

  const subtotal = useMemo(() => subtotalNet + ivaAmount, [subtotalNet, ivaAmount]);

  const discount = parseFloat(discountPct) || 0;
  const total = useMemo(() => subtotal * (1 - discount / 100), [subtotal, discount]);

  const loadProductMeta = useCallback(async (sku: SKU): Promise<CartLine | null> => {
    try {
      const [price, avail] = await Promise.all([
        pricingApi.resolveB2C(sku.id),
        stockApi.availability(sku.id),
      ]);
      const qty = avail.qty_available ?? 0;
      if (qty <= 0) {
        setError(`Sem estoque para ${sku.code}`);
        return null;
      }
      return {
        sku_id: sku.id,
        code: sku.code,
        name: sku.name,
        base_price_usd: price.base_price_usd,
        price_with_iva_usd: price.price_with_iva_usd ?? price.base_price_usd,
        price_pyg: price.price_pyg,
        price_with_iva_pyg: price.price_with_iva_pyg,
        qty_available: qty,
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
        const seen = new Set<string>();
        const out: SKU[] = [];
        const push = (sku: SKU | null | undefined) => {
          if (!sku?.id || !sku.is_active || seen.has(sku.id)) return;
          seen.add(sku.id);
          out.push(sku);
        };

        if (/^AAA\d+$/i.test(term)) {
          const unit = await stockApi.unitByCode(term).catch(() => null);
          if (unit?.sku_id) {
            const sku = await pimApi.getSku(unit.sku_id).catch(() => null);
            push(sku);
          }
        }

        if (/^\d{1,6}$/.test(term)) {
          const byCode = await pimApi.getSkuByCode(term).catch(() => null);
          push(byCode);
        }

        const res = await pimApi.searchSkus(term);
        for (const sku of res.items ?? []) push(sku);
        setSearchResults(out);
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

  const applyCustomer = useCallback((c: Customer) => {
    setCustomerId(c.id);
    setLastCustomer(c);
    if (c.residency === "paraguayan") setProfile("paraguayan");
    else if (c.residency === "foreigner") setProfile("foreigner");
  }, []);

  const searchCustomers = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setCustomers([]);
        setCustomerSearching(false);
        return;
      }
      try {
        const res = await posApi.searchCustomers(term);
        const items = (res.items ?? []).filter((c) => c.id !== walkIn?.id && customerMatchesQuery(c, term));
        setCustomers(items);
        const qDigits = digitsOnly(term);
        const exact = items.filter((c) => digitsOnly(c.document_id) && digitsOnly(c.document_id) === qDigits);
        if (qDigits.length >= 5 && exact.length >= 1) {
          applyCustomer(exact[0]);
        } else if (items.length === 1 && term.length >= 3) {
          applyCustomer(items[0]);
        }
      } catch {
        /* keep current list */
      } finally {
        setCustomerSearching(false);
      }
    },
    [walkIn?.id, applyCustomer],
  );

  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerSearching(false);
      setCustomers([]);
      return;
    }
    setCustomerSearching(true);
    const t = setTimeout(() => void searchCustomers(customerQuery), 200);
    return () => clearTimeout(t);
  }, [customerQuery, searchCustomers]);

  const selectedCustomer = useMemo(() => {
    if (customerId && customerId === walkIn?.id) return walkIn;
    return customers.find((c) => c.id === customerId) ?? lastCustomer ?? walkIn;
  }, [customers, customerId, walkIn, lastCustomer]);

  const identifiedHits = useMemo(
    () => customers.filter((c) => c.id !== walkIn?.id && customerMatchesQuery(c, customerQuery)),
    [customers, customerQuery, walkIn?.id],
  );

  const queryLockedToSelected = Boolean(
    selectedCustomer &&
      selectedCustomer.id !== walkIn?.id &&
      ((digitsOnly(customerQuery).length >= 5 &&
        digitsOnly(selectedCustomer.document_id) === digitsOnly(customerQuery)) ||
        selectedCustomer.name.toLowerCase() === customerQuery.trim().toLowerCase()),
  );

  const profileFallback =
    profile === "paraguayan" ? "Paraguaio" : profile === "foreigner" ? "Estrangeiro" : undefined;

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
            setInfo(
              (prev) =>
                `${prev}${prev ? " · " : ""}Comprovante abaixo — use Imprimir comprovante ou o botão no preview.`,
            );
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar comprovante");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lastOrder?.id]);

  async function printReceipt(orderId?: string) {
    setPrinting(true);
    setError("");
    try {
      const html = receiptHtml || (await loadReceiptHtml(orderId ?? lastOrder!.id));
      if (!printHTML(html)) {
        setError("Pop-up bloqueado — use o preview abaixo e o botão Imprimir comprovante.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir comprovante");
    } finally {
      setPrinting(false);
    }
  }

  const brlRate = useMemo(
    () => exchangeRates?.rates?.find((q) => q.to_currency === "BRL")?.rate ?? null,
    [exchangeRates],
  );
  const totalBRL = brlRate != null ? total * brlRate : null;

  function resetSale() {
    setCart([]);
    setLastOrder(null);
    setLastCustomer(null);
    setReceiptHtml("");
    setDiscountPct("0");
    setCustomerId(walkIn?.id ?? "");
    setCustomerQuery("");
    setProfile("walkin");
    setQuery("");
    setSearchResults([]);
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

  const effectiveCustomerId =
    profile === "walkin" ? walkIn?.id : customerId;

  async function finalizeSale(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Adicione pelo menos um produto");
      return;
    }
    if (profile !== "walkin" && (!customerId || customerId === walkIn?.id)) {
      setError("Selecione ou cadastre o cliente (paraguaio ou estrangeiro) antes de finalizar");
      return;
    }
    setSubmitting(true);
    setError("");
    setInfo("");
    try {
      const pix = await posApi.pixInit({
        customer_id: effectiveCustomerId || undefined,
        buyer_profile: profile,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        items: cart.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
        discount_pct: discount,
      });
      setPixSession(pix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar venda");
    } finally {
      setSubmitting(false);
    }
  }

  function onPixConfirmed(order: Order) {
    setPixSession(null);
    autoPrintReceiptRef.current = true;
    setLastOrder(order);
    setLastCustomer(profile === "walkin" ? null : selectedCustomer ?? null);
    setCart([]);
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
        {lastOrder ? null : (
          <p className="text-sm text-slate-500">
            1. Cliente · 2. Produtos · 3. Pagamento · 4. Comprovante
          </p>
        )}
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info && !lastOrder ? <Alert tone="success">{info}</Alert> : null}

      {lastOrder ? (
        <Card>
          <div className="space-y-4 text-center sm:text-left">
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-700">Venda concluída</p>
            <h2 className="text-2xl font-semibold text-slate-900">{lastOrder.order_number}</h2>
            <p className="text-slate-600">
              {lastCustomer ? (
                <>
                  {lastCustomer.name}
                  {" · "}
                  {customerProfileLabel(lastCustomer, walkIn?.id, profileFallback)}
                  {lastCustomer.document_id
                    ? ` · ${documentTypeLabel(lastCustomer.document_type)} ${lastCustomer.document_id}`
                    : ""}
                </>
              ) : (
                "Consumidor final"
              )}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              Total US$ {lastOrder.total_usd.toFixed(2)}
              {lastOrder.total_usd && brlRate
                ? ` · R$ ${(lastOrder.total_usd * brlRate).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : ""}
            </p>
            <p className="text-sm text-slate-500">{info}</p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button type="button" disabled={printing || !receiptHtml} onClick={() => void printReceipt()}>
                {printing ? "Abrindo…" : "Imprimir comprovante"}
              </Button>
              <Link href={`/pedidos/${lastOrder.id}`}>
                <Button type="button" variant="secondary">
                  Ver pedido
                </Button>
              </Link>
              <Button type="button" variant="secondary" onClick={resetSale}>
                Nova venda
              </Button>
            </div>
            {receiptHtml ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <iframe
                  title={`Comprovante ${lastOrder.order_number}`}
                  srcDoc={receiptHtml}
                  className="h-[28rem] w-full bg-white"
                  sandbox="allow-same-origin allow-modals allow-scripts"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Carregando comprovante…</p>
            )}
          </div>
        </Card>
      ) : (
      <>
      <PDVExchangeRatesPanel data={exchangeRates} loading={ratesLoading} totalUsd={total} />

      <Card title="1. Cliente">
        <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-start">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
                profile === "paraguayan"
                  ? "border-blue-600 bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
              onClick={() => {
                setProfile("paraguayan");
                if (customerId === walkIn?.id) setCustomerId("");
              }}
            >
              Paraguaio
            </button>
            <button
              type="button"
              className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
                profile === "foreigner"
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
              onClick={() => {
                setProfile("foreigner");
                if (customerId === walkIn?.id) setCustomerId("");
              }}
            >
              Estrangeiro
            </button>
            <button
              type="button"
              className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
                profile === "walkin"
                  ? "border-slate-700 bg-slate-100 text-slate-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
              onClick={() => {
                setProfile("walkin");
                setCustomerId(walkIn?.id ?? "");
                setCustomerQuery("");
                setCustomers([]);
                setLastCustomer(null);
              }}
            >
              Consumidor final
            </button>
          </div>

          <div className="space-y-3">
            {profile !== "walkin" ? (
              <>
                <Field
                  label={profile === "paraguayan" ? "C.I., RUC ou nome" : "CPF, RG, passaporte ou nome"}
                  hint={
                    profile === "paraguayan"
                      ? "Pessoa física: C.I. (consumidor final) ou RUC pessoal. Empresa: RUC com razão social."
                      : profile === "foreigner"
                        ? "Brasileiro: no cadastro, anexe a foto do documento se for cliente novo"
                        : undefined
                  }
                >
                  <Input
                    value={customerQuery}
                    autoFocus
                    placeholder="Digite ou leia o documento…"
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                </Field>
                {identifiedHits.length > 0 && !queryLockedToSelected ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {identifiedHits.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm ${
                          c.id === customerId
                            ? "border-blue-400 bg-blue-50"
                            : "border-slate-200 hover:border-blue-300"
                        }`}
                        onClick={() => {
                          applyCustomer(c);
                          setCustomerQuery(c.document_id || c.name);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-slate-500">
                          {customerProfileLabel(c, walkIn?.id, profileFallback)}
                          {c.document_id ? ` · ${documentTypeLabel(c.document_type)} ${c.document_id}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : customerSearching ? (
                  <p className="text-sm text-slate-500">Buscando…</p>
                ) : customerQuery.trim() && !queryLockedToSelected ? (
                  <p className="text-sm text-slate-500">Nenhum cadastro com esse documento.</p>
                ) : null}
                {selectedCustomer && selectedCustomer.id !== walkIn?.id ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <p className="font-medium">
                      {profile === "paraguayan" && selectedCustomer.document_type === "ci_py"
                        ? `${selectedCustomer.name} · comprovante como Consumidor Final`
                        : selectedCustomer.name}
                    </p>
                    <p>
                      {customerProfileLabel(selectedCustomer, walkIn?.id, profileFallback)}
                      {selectedCustomer.document_id
                        ? ` · ${documentTypeLabel(selectedCustomer.document_type)} ${selectedCustomer.document_id}`
                        : ""}
                      {selectedCustomer.has_document_scan ? " · documento escaneado" : ""}
                    </p>
                    {profile === "paraguayan" && selectedCustomer.document_type ? (
                      <p className="mt-1 text-xs text-emerald-800">
                        {paraguayanBuyerKindLabel(selectedCustomer.document_type)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Button type="button" className="w-full sm:w-auto" onClick={() => setCustomerModal(true)}>
                    {customerQuery.trim() ? "Cadastrar este cliente" : "Cadastrar cliente"}
                  </Button>
                )}
              </>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Venda sem identificação — o comprovante sai como consumidor final.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title="2. Produtos">
            <form onSubmit={onSearchSubmit}>
              <Input
                inputRef={searchRef}
                autoFocus={profile === "walkin"}
                placeholder="SKU, nome, marca, categoria ou código da peça…"
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
                        USD {lineUnitUsd(line, chargesIVA).toFixed(2)}
                        {chargesIVA ? " c/ IVA" : ""}
                        {(chargesIVA ? line.price_with_iva_pyg : line.price_pyg)
                          ? ` · ₲ ${Math.round(chargesIVA ? line.price_with_iva_pyg! : line.price_pyg!).toLocaleString("es-PY")}`
                          : ""}
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
                      ${(lineUnitUsd(line, chargesIVA) * line.quantity).toFixed(2)}
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

        <div className="lg:sticky lg:top-4 lg:col-span-2 lg:self-start">
          <Card title="3. Pagamento">
            <form className="space-y-4" onSubmit={finalizeSale}>
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
                    ? `: R$ ${totalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                              ? (total * q.rate).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : Math.round(total * q.rate).toLocaleString("es-PY")}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>

              <Button type="submit" disabled={submitting || cart.length === 0 || pixSession != null || (profile !== "walkin" && (!customerId || customerId === walkIn?.id))} className="w-full">
                {submitting
                  ? "Processando…"
                  : totalBRL != null
                    ? `Gerar QR PIX · R$ ${totalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "Gerar QR PIX"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
      </>
      )}

      {pixSession ? (
        <PDVPixModal
          data={pixSession}
          shipImmediately={shipImmediately}
          onConfirmed={onPixConfirmed}
          onCancelled={onPixCancelled}
        />
      ) : null}
      {customerModal ? (
        <PDVCustomerModal
          initialResidency={profile === "walkin" ? "" : profile}
          initialDocument={customerQuery}
          onClose={() => setCustomerModal(false)}
          onCreated={(customer) => {
            applyCustomer(customer);
            setCustomers((prev) => [customer, ...prev.filter((c) => c.id !== customer.id)]);
            setCustomerQuery(customer.document_id ?? customer.name);
            setCustomerModal(false);
          }}
        />
      ) : null}
    </div>
  );
}
