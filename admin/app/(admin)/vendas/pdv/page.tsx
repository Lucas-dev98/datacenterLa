"use client";

/**
 * PDV (ponto de venda) — balcão com PIX e expedição imediata.
 *
 * Estado e efeitos ficam aqui; UI em `@/components/pdv/*`.
 */
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { printHTML } from "@/lib/api/client";
import { usePdvBootstrap } from "@/hooks/use-pdv-bootstrap";
import { usePosPixInit } from "@/hooks/use-pos-mutations";
import { posApi, type POSPixInitResponse } from "@/lib/api/pos";
import { pricingApi } from "@/lib/api/pricing";
import { stockApi } from "@/lib/api/stock";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { Customer, Order, SKU } from "@/lib/types";
import { searchPdvSkus } from "@/lib/pdv-product-search";
import type { CartLine } from "@/lib/pdv-types";
import { Alert } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { PDVExchangeRatesPanel } from "@/components/pdv-exchange-rates";
import { PDVPixModal } from "@/components/pdv-pix-modal";
import { PDVCustomerModal } from "@/components/pdv-customer-modal";
import { PDVSaleComplete } from "@/components/pdv/pdv-sale-complete";
import { PDVCustomerStep, type PdvBuyerProfile } from "@/components/pdv/pdv-customer-step";
import { PDVProductsPanel } from "@/components/pdv/pdv-products-panel";
import { PDVCheckoutPanel } from "@/components/pdv/pdv-checkout-panel";
import { customerMatchesQuery, digitsOnly } from "@/lib/customer-profile";
import { paraguayIVAFromNet } from "@/lib/paraguay-tax";

export default function PDVPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SKU[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const { data: bootstrap, error: bootstrapError, loading: ratesLoading } = usePdvBootstrap();
  const walkIn = bootstrap?.walkIn ?? null;
  const exchangeRates = bootstrap?.exchangeRates ?? null;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [shipImmediately, setShipImmediately] = useState(true);
  const [discountPct, setDiscountPct] = useState("0");
  const [error, setError] = useState("");
  const toast = useToast();
  const [saleSummary, setSaleSummary] = useState("");
  const { run: initPix, loading: submitting, setError: setPixInitError } = usePosPixInit();
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [pixSession, setPixSession] = useState<POSPixInitResponse | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [printing, setPrinting] = useState(false);
  const [profile, setProfile] = useState<PdvBuyerProfile>("walkin");
  const [lastCustomer, setLastCustomer] = useState<Customer | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState("");
  const autoPrintReceiptRef = useRef(false);

  useEffect(() => {
    if (bootstrapError) {
      setError(bootstrapError);
      return;
    }
    if (!bootstrap) return;
    setCustomerId(bootstrap.walkIn.id);
    setError("");
  }, [bootstrap, bootstrapError]);

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

  const searchProducts = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      setSearchResults(await searchPdvSkus(term));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na busca");
    } finally {
      setSearching(false);
    }
  }, []);

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
            toast.push(
              "Comprovante abaixo — use Imprimir comprovante ou o botão no preview.",
              "info",
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
  }, [lastOrder?.id, toast]);

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
    setSaleSummary("");
    setError("");
    setPixSession(null);
    searchRef.current?.focus();
  }

  async function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchResults.length >= 1) {
      await addToCart(searchResults[0]);
    }
  }

  const effectiveCustomerId = profile === "walkin" ? walkIn?.id : customerId;

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
    setError("");
    setPixInitError("");
    try {
      const pix = await initPix({
        customer_id: effectiveCustomerId || undefined,
        buyer_profile: profile,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        items: cart.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
        discount_pct: discount,
      });
      setPixSession(pix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar venda");
    }
  }

  function onPixConfirmed(order: Order) {
    setPixSession(null);
    autoPrintReceiptRef.current = true;
    setLastOrder(order);
    setLastCustomer(profile === "walkin" ? null : selectedCustomer ?? null);
    setCart([]);
    setSaleSummary(
      shipImmediately
        ? `Venda ${order.order_number} concluída via PIX — cliente retira na hora`
        : `Venda ${order.order_number} registrada via PIX — pedido na fila de expedição`,
    );
  }

  function onPixCancelled() {
    setPixSession(null);
    toast.push("Venda PIX cancelada — estoque liberado.", "info");
  }

  function onProfileChange(next: PdvBuyerProfile) {
    setProfile(next);
    if (next === "walkin") {
      setCustomerId(walkIn?.id ?? "");
      setCustomerQuery("");
      setCustomers([]);
      setLastCustomer(null);
      return;
    }
    if (customerId === walkIn?.id) setCustomerId("");
  }

  const canFinalize = profile === "walkin" || Boolean(customerId && customerId !== walkIn?.id);

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

      {lastOrder ? (
        <PDVSaleComplete
          order={lastOrder}
          customer={lastCustomer}
          walkInId={walkIn?.id}
          profileFallback={profileFallback}
          brlRate={brlRate}
          saleSummary={saleSummary}
          receiptHtml={receiptHtml}
          printing={printing}
          onPrint={() => void printReceipt()}
          onNewSale={resetSale}
        />
      ) : (
        <>
          <PDVExchangeRatesPanel data={exchangeRates} loading={ratesLoading} totalUsd={total} />

          <PDVCustomerStep
            profile={profile}
            onProfileChange={onProfileChange}
            walkIn={walkIn}
            customerQuery={customerQuery}
            onCustomerQueryChange={setCustomerQuery}
            customerSearching={customerSearching}
            identifiedHits={identifiedHits}
            queryLockedToSelected={queryLockedToSelected}
            selectedCustomer={selectedCustomer}
            customerId={customerId}
            profileFallback={profileFallback}
            onSelectCustomer={applyCustomer}
            onOpenRegisterModal={() => setCustomerModal(true)}
          />

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PDVProductsPanel
                searchRef={searchRef}
                autoFocusSearch={profile === "walkin"}
                query={query}
                onQueryChange={setQuery}
                onSearchSubmit={(e) => void onSearchSubmit(e)}
                searching={searching}
                searchResults={searchResults}
                onAddSku={(sku) => void addToCart(sku)}
                cart={cart}
                chargesIVA={chargesIVA}
                onUpdateQty={updateQty}
                onRemoveLine={removeLine}
              />
            </div>

            <div className="lg:col-span-2">
              <PDVCheckoutPanel
                profile={profile}
                selectedCustomer={selectedCustomer}
                walkIn={walkIn}
                profileFallback={profileFallback}
                chargesIVA={chargesIVA}
                subtotalNet={subtotalNet}
                ivaAmount={ivaAmount}
                subtotal={subtotal}
                discount={discount}
                total={total}
                totalBRL={totalBRL}
                exchangeRates={exchangeRates}
                discountPct={discountPct}
                onDiscountPctChange={setDiscountPct}
                shipImmediately={shipImmediately}
                onShipImmediatelyChange={setShipImmediately}
                submitting={submitting}
                cartEmpty={cart.length === 0}
                pixOpen={pixSession != null}
                canFinalize={canFinalize}
                onSubmit={(e) => void finalizeSale(e)}
              />
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
