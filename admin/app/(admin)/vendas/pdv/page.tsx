"use client";

/**
 * PDV (ponto de venda) — balcão com PIX e expedição imediata.
 */
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePdvBootstrap } from "@/hooks/use-pdv-bootstrap";
import { usePdvCart } from "@/hooks/use-pdv-cart";
import { usePdvCustomer } from "@/hooks/use-pdv-customer";
import { usePdvReceipt } from "@/hooks/use-pdv-receipt";
import { usePosPixInit } from "@/hooks/use-pos-mutations";
import type { POSPixInitResponse } from "@/lib/api/pos";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { Order } from "@/lib/types";
import { Alert } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { PDVExchangeRatesPanel } from "@/components/pdv/exchange-rates";
import { PDVPixModal } from "@/components/pdv/pix-modal";
import { PDVCustomerModal } from "@/components/pdv/customer-modal";
import { PDVSaleComplete } from "@/components/pdv/pdv-sale-complete";
import { PDVCustomerStep } from "@/components/pdv/pdv-customer-step";
import { PDVProductsPanel } from "@/components/pdv/pdv-products-panel";
import { PDVCheckoutPanel } from "@/components/pdv/pdv-checkout-panel";
import { paraguayIVAFromNet } from "@/lib/paraguay-tax";

export default function PDVPage() {
  const [error, setError] = useState("");
  const clearError = useCallback(() => setError(""), []);
  const onError = useCallback((message: string) => setError(message), []);

  const { data: bootstrap, error: bootstrapError, loading: ratesLoading } = usePdvBootstrap();
  const walkIn = bootstrap?.walkIn ?? null;
  const exchangeRates = bootstrap?.exchangeRates ?? null;

  const cartState = usePdvCart({ onError, clearError });
  const customerState = usePdvCustomer(walkIn);

  const [shipImmediately, setShipImmediately] = useState(true);
  const [discountPct, setDiscountPct] = useState("0");
  const toast = useToast();
  const { run: initPix, loading: submitting, setError: setPixInitError } = usePosPixInit();
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [pixSession, setPixSession] = useState<POSPixInitResponse | null>(null);

  const receiptState = usePdvReceipt({ lastOrder, onError, clearError });

  useEffect(() => {
    if (bootstrapError) {
      setError(bootstrapError);
      return;
    }
    if (bootstrap) setError("");
  }, [bootstrap, bootstrapError]);

  const subtotalNet = useMemo(
    () => cartState.cart.reduce((sum, line) => sum + line.base_price_usd * line.quantity, 0),
    [cartState.cart],
  );
  const ivaAmount = useMemo(
    () => (customerState.chargesIVA ? paraguayIVAFromNet(subtotalNet) : 0),
    [customerState.chargesIVA, subtotalNet],
  );
  const subtotal = useMemo(() => subtotalNet + ivaAmount, [subtotalNet, ivaAmount]);
  const discount = parseFloat(discountPct) || 0;
  const total = useMemo(() => subtotal * (1 - discount / 100), [subtotal, discount]);

  const brlRate = useMemo(
    () => exchangeRates?.rates?.find((q) => q.to_currency === "BRL")?.rate ?? null,
    [exchangeRates],
  );
  const totalBRL = brlRate != null ? total * brlRate : null;

  function resetSale() {
    cartState.clearCart();
    setLastOrder(null);
    customerState.resetCustomer();
    receiptState.resetReceipt();
    setDiscountPct("0");
    clearError();
    setPixSession(null);
    cartState.focusSearch();
  }

  async function finalizeSale(e: FormEvent) {
    e.preventDefault();
    if (cartState.cart.length === 0) {
      onError("Adicione pelo menos um produto");
      return;
    }
    if (
      customerState.profile !== "walkin" &&
      (!customerState.customerId || customerState.customerId === walkIn?.id)
    ) {
      onError("Selecione ou cadastre o cliente (paraguaio ou estrangeiro) antes de finalizar");
      return;
    }
    clearError();
    setPixInitError("");
    try {
      const pix = await initPix({
        customer_id: customerState.effectiveCustomerId || undefined,
        buyer_profile: customerState.profile,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        items: cartState.cart.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
        discount_pct: discount,
      });
      setPixSession(pix);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao finalizar venda");
    }
  }

  function onPixConfirmed(order: Order) {
    setPixSession(null);
    receiptState.markAutoPrint();
    setLastOrder(order);
    customerState.setLastCustomer(
      customerState.profile === "walkin" ? null : customerState.selectedCustomer ?? null,
    );
    cartState.clearCart();
    receiptState.setSaleSummary(
      shipImmediately
        ? `Venda ${order.order_number} concluída via PIX — cliente retira na hora`
        : `Venda ${order.order_number} registrada via PIX — pedido na fila de expedição`,
    );
  }

  function onPixCancelled() {
    setPixSession(null);
    toast.push("Venda PIX cancelada — estoque liberado.", "info");
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

      {lastOrder ? (
        <PDVSaleComplete
          order={lastOrder}
          customer={customerState.lastCustomer}
          walkInId={walkIn?.id}
          profileFallback={customerState.profileFallback}
          brlRate={brlRate}
          saleSummary={receiptState.saleSummary}
          receiptHtml={receiptState.receiptHtml}
          printing={receiptState.printing}
          onPrint={() => void receiptState.printReceipt()}
          onNewSale={resetSale}
        />
      ) : (
        <>
          <PDVExchangeRatesPanel data={exchangeRates} loading={ratesLoading} totalUsd={total} />

          <PDVCustomerStep
            profile={customerState.profile}
            onProfileChange={customerState.onProfileChange}
            walkIn={walkIn}
            customerQuery={customerState.customerQuery}
            onCustomerQueryChange={customerState.setCustomerQuery}
            customerSearching={customerState.customerSearching}
            identifiedHits={customerState.identifiedHits}
            queryLockedToSelected={customerState.queryLockedToSelected}
            selectedCustomer={customerState.selectedCustomer}
            customerId={customerState.customerId}
            profileFallback={customerState.profileFallback}
            onSelectCustomer={customerState.applyCustomer}
            onOpenRegisterModal={() => customerState.setCustomerModal(true)}
          />

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PDVProductsPanel
                searchRef={cartState.searchRef}
                autoFocusSearch={customerState.profile === "walkin"}
                query={cartState.query}
                onQueryChange={cartState.setQuery}
                onSearchSubmit={(e) => void cartState.onSearchSubmit(e)}
                searching={cartState.searching}
                searchResults={cartState.searchResults}
                onAddSku={(sku) => void cartState.addToCart(sku)}
                cart={cartState.cart}
                chargesIVA={customerState.chargesIVA}
                onUpdateQty={cartState.updateQty}
                onRemoveLine={cartState.removeLine}
              />
            </div>

            <div className="lg:col-span-2">
              <PDVCheckoutPanel
                profile={customerState.profile}
                selectedCustomer={customerState.selectedCustomer}
                walkIn={walkIn}
                profileFallback={customerState.profileFallback}
                chargesIVA={customerState.chargesIVA}
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
                cartEmpty={cartState.cart.length === 0}
                pixOpen={pixSession != null}
                canFinalize={customerState.canFinalize}
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
      {customerState.customerModal ? (
        <PDVCustomerModal
          initialResidency={customerState.profile === "walkin" ? "" : customerState.profile}
          initialDocument={customerState.customerQuery}
          onClose={() => customerState.setCustomerModal(false)}
          onCreated={customerState.onCustomerCreated}
        />
      ) : null}
    </div>
  );
}
