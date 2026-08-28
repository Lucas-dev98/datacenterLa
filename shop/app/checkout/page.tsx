"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  checkout,
  confirmPaymentIntent,
  fetchCart,
  fetchPaymentConfig,
  type PaymentConfig,
  type PaymentIntent,
} from "@/lib/api";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { getSessionId } from "@/lib/session";
import type { Cart, Order } from "@/lib/types";
import { ShopShell } from "@/components/shop-shell";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { StripePaymentForm } from "@/components/stripe-payment-form";

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PaymentIntent | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentId, setDocumentId] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [cartData, config] = await Promise.all([
          fetchCart(getSessionId()),
          fetchPaymentConfig().catch(() => ({ provider: "mock" } as PaymentConfig)),
        ]);
        setCart(cartData);
        setPaymentConfig(config);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar carrinho");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const items = cart?.items ?? [];
  const total = items.reduce((sum, i) => sum + (i.price_usd ?? 0) * i.quantity, 0);

  const provider = paymentConfig?.provider ?? "mock";

  async function handleInfoSubmit(e: FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setSubmitting(true);
    setError("");
    const sessionId = getSessionId();
    try {
      const result = await checkout({
        session_id: sessionId,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        document_id: documentId.trim() || undefined,
      });
      if (result.payment_intent.provider === "stripe") {
        setPendingIntent(result.payment_intent);
        setOrder(result.order);
        return;
      }
      await confirmPaymentIntent(result.payment_intent.id, sessionId);
      setOrder(result.order);
      setCart(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no checkout");
      try {
        setCart(await fetchCart(sessionId));
      } catch {
        /* ignore refresh errors */
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStripeSuccess() {
    if (!pendingIntent) return;
    const sessionId = getSessionId();
    await confirmPaymentIntent(pendingIntent.id, sessionId);
    setPendingIntent(null);
    setCart(null);
  }

  if (order && !pendingIntent) {
    return (
      <ShopShell crumbs={[{ href: "/cart", label: "Carrinho" }, { label: "Pedido" }]}>
      <div className="mx-auto max-w-lg space-y-4">
        <Alert tone="success">
          Pedido <strong>{order.order_number}</strong> pago com sucesso
          {provider === "stripe" ? " via Stripe" : " via gateway (mock)"}.
          Status: {order.status} · Total USD ${order.total_usd.toFixed(2)}
        </Alert>
        <Link href={`/conta?email=${encodeURIComponent(email.trim().toLowerCase())}`}>
          <Button variant="secondary">Ver meus pedidos</Button>
        </Link>
        <p className="text-xs text-slate-500">
          Você receberá um código no e-mail do checkout para acessar seus pedidos com segurança.
        </p>
      </div>
      </ShopShell>
    );
  }

  if (loading) {
    return (
      <ShopShell crumbs={[{ href: "/cart", label: "Carrinho" }, { label: "Checkout" }]}>
        <p className="text-sm text-neutral-500">Carregando…</p>
      </ShopShell>
    );
  }

  return (
    <ShopShell crumbs={[{ href: "/cart", label: "Carrinho" }, { label: "Checkout" }]}>
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">Passo 2 de 2</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Checkout</h1>
        <p className="mt-1 text-sm text-slate-600">
          {provider === "stripe"
            ? "Pagamento seguro com Stripe"
            : "Pagamento seguro (gateway mock em dev)"}
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {pendingIntent && paymentConfig?.stripe_publishable_key ? (
        <Card title={`Pagar USD $${total.toFixed(2)}`}>
          <p className="mb-4 text-sm text-slate-600">
            Pedido <strong>{order?.order_number}</strong> criado. Informe o cartão abaixo.
          </p>
          <StripePaymentForm
            publishableKey={paymentConfig.stripe_publishable_key}
            clientSecret={pendingIntent.client_secret}
            onSuccess={handleStripeSuccess}
            submitLabel={`Pagar USD $${total.toFixed(2)}`}
          />
        </Card>
      ) : (
        <Card title={`Total USD $${total.toFixed(2)}`}>
          <form className="space-y-4" onSubmit={(e) => void handleInfoSubmit(e)}>
            <Field label="Nome completo">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Documento">
              <Input value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
            </Field>
            <Button type="submit" disabled={submitting || items.length === 0}>
              {submitting
                ? "Processando…"
                : provider === "stripe"
                  ? "Continuar para pagamento"
                  : "Pagar agora"}
            </Button>
          </form>
        </Card>
      )}
    </div>
    </ShopShell>
  );
}
