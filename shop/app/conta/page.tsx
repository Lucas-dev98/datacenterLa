"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMyOrder, listMyOrders, requestShopLoginCode, verifyShopLoginCode } from "@/lib/api";
import {
  clearShopSession,
  getShopEmail,
  isShopAuthenticated,
  saveShopSession,
} from "@/lib/auth";
import type { PublicOrder } from "@/lib/types";
import { ShopShell } from "@/components/shop-shell";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

const TIMELINE: { status: string; label: string }[] = [
  { status: "confirmed", label: "Pedido confirmado" },
  { status: "paid", label: "Pagamento recebido" },
  { status: "picking", label: "Em separação" },
  { status: "shipped", label: "Expedido" },
  { status: "delivered", label: "Entregue" },
];

function timelineIndex(status: string): number {
  const idx = TIMELINE.findIndex((s) => s.status === status);
  if (idx >= 0) return idx;
  if (status === "draft") return -1;
  if (status === "cancelled") return -2;
  return 0;
}

function OrderDetail({ order }: { order: PublicOrder }) {
  const step = timelineIndex(order.status);

  return (
    <>
      <Card title={`Pedido ${order.order_number}`}>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">{order.status_label ?? order.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Total</dt>
            <dd>USD {order.total_usd.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Cliente</dt>
            <dd>{order.customer_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Data</dt>
            <dd>{new Date(order.created_at).toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
      </Card>

      {order.status !== "cancelled" ? (
        <Card title="Acompanhamento">
          <ol className="space-y-3">
            {TIMELINE.map((s, i) => {
              const done = step >= i;
              const current = step === i;
              return (
                <li key={s.status} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                      done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                    } ${current ? "ring-2 ring-emerald-300" : ""}`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={done ? "font-medium text-slate-900" : "text-slate-500"}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <Alert tone="error">Este pedido foi cancelado.</Alert>
      )}

      {order.items && order.items.length > 0 ? (
        <Card title="Itens">
          <ul className="divide-y divide-slate-100 text-sm">
            {order.items.map((item) => (
              <li key={item.sku_code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-mono text-xs text-slate-500">{item.sku_code}</p>
                  <p className="font-medium">{item.sku_name ?? "—"}</p>
                </div>
                <div className="text-right text-slate-600">
                  <p>
                    {item.quantity} × USD {item.unit_price_usd.toFixed(2)}
                  </p>
                  <p className="font-medium text-slate-900">USD {item.line_total_usd.toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

type LoginStep = "email" | "code";

export default function ContaPage() {
  const searchParams = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [orderList, setOrderList] = useState<PublicOrder[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOrders = useCallback(async (number?: string) => {
    setLoading(true);
    setError("");
    setOrder(null);
    setOrderList([]);
    try {
      if (number?.trim()) {
        setOrder(await getMyOrder(number.trim()));
        return;
      }
      const items = await listMyOrders();
      if (items.length === 0) {
        setError("Nenhum pedido encontrado para sua conta.");
        return;
      }
      if (items.length === 1) {
        setOrder(await getMyOrder(items[0].order_number));
        return;
      }
      setOrderList(items);
    } catch (err) {
      if (err instanceof Error && err.message.includes("login")) {
        clearShopSession();
        setLoggedIn(false);
        setLoginStep("email");
      }
      setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const qEmail = searchParams.get("email");
    if (qEmail) setEmail(qEmail);
    const qOrder = searchParams.get("order_number");
    if (qOrder) setOrderNumber(qOrder);

    if (isShopAuthenticated()) {
      setLoggedIn(true);
      if (!qEmail && getShopEmail()) setEmail(getShopEmail() ?? "");
      void loadOrders(qOrder ?? undefined);
    }
  }, [searchParams, loadOrders]);

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await requestShopLoginCode(email);
      setInfo(res.message);
      setLoginStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await verifyShopLoginCode(email, code);
      saveShopSession(tokens.access_token, tokens.email);
      setLoggedIn(true);
      setLoginStep("email");
      setCode("");
      await loadOrders(orderNumber.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  async function openFromList(item: PublicOrder) {
    setLoading(true);
    setError("");
    try {
      setOrder(await getMyOrder(item.order_number));
      setOrderList([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearShopSession();
    setLoggedIn(false);
    setLoginStep("email");
    setOrder(null);
    setOrderList([]);
    setCode("");
    setError("");
    setInfo("");
  }

  if (!loggedIn) {
    return (
      <ShopShell crumbs={[{ label: "Pedidos" }]}>
      <div className="mx-auto max-w-lg space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Meus pedidos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Entre com o e-mail usado no checkout. Enviaremos um código de acesso.
          </p>
        </header>

        {loginStep === "email" ? (
          <Card title="Entrar">
            <form onSubmit={(e) => void handleRequestCode(e)} className="space-y-4">
              <Field label="E-mail">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                />
              </Field>
              <Button type="submit" disabled={loading}>
                {loading ? "Enviando…" : "Enviar código"}
              </Button>
            </form>
          </Card>
        ) : (
          <Card title="Código de acesso">
            <form onSubmit={(e) => void handleVerifyCode(e)} className="space-y-4">
              <p className="text-sm text-slate-600">
                Digite o código de 6 dígitos enviado para <strong>{email}</strong>.
              </p>
              <Field label="Código">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading || code.length !== 6}>
                  {loading ? "Verificando…" : "Entrar"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setLoginStep("email")}>
                  Voltar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {info ? <Alert tone="info">{info}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
      </ShopShell>
    );
  }

  return (
    <ShopShell crumbs={[{ label: "Pedidos" }]}>
    <div className="mx-auto max-w-lg space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meus pedidos</h1>
          <p className="mt-1 text-sm text-slate-600">Conectado como {getShopEmail() ?? email}</p>
        </div>
        <Button type="button" variant="secondary" onClick={handleLogout}>
          Sair
        </Button>
      </header>

      <Card title="Buscar pedido">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadOrders(orderNumber.trim() || undefined);
          }}
          className="space-y-4"
        >
          <Field label="Número do pedido (opcional)">
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="PED-000123 ou 000123"
            />
          </Field>
          <p className="text-xs text-slate-500">Deixe em branco para listar todos os seus pedidos.</p>
          <Button type="submit" disabled={loading}>
            {loading ? "Carregando…" : "Atualizar"}
          </Button>
        </form>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {orderList.length > 0 ? (
        <Card title="Seus pedidos">
          <ul className="divide-y divide-slate-100">
            {orderList.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-mono text-sm font-medium">{item.order_number}</p>
                  <p className="text-xs text-slate-500">
                    {item.status_label ?? item.status} · {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => void openFromList(item)}>
                  Ver
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {order ? <OrderDetail order={order} /> : null}
    </div>
    </ShopShell>
  );
}
