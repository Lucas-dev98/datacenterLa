"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { printHTML } from "@/lib/api/client";
import { paymentsApi } from "@/lib/api/payments";
import { salesApi } from "@/lib/api/sales";
import {
  useConfirmPaymentIntent,
  useCreatePaymentIntent,
} from "@/hooks/use-payment-mutations";
import { hasPermission } from "@/lib/permissions";
import { useAuth } from "@/components/auth-provider";
import { useOrderDetail } from "@/hooks/use-order-detail";
import {
  useCancelOrder,
  useConfirmOrder,
  useConfirmOrderCredit,
  useRecordOrderPayment,
} from "@/hooks/use-sales-order-mutations";
import { orderChannelLabel } from "@/lib/order-channels";
import { orderStatusLabel } from "@/lib/status-labels";
import type { PaymentIntent } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import { ShipExpeditionModal } from "@/components/ship-expedition-modal";
import { OrderShipPhotosGallery } from "@/components/order-ship-photos-gallery";

export default function PedidoDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { order, customer, error, loading, refetch, setOrder } = useOrderDetail(params.id);
  const [actionError, setActionError] = useState("");
  const toast = useToast();
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("transfer");
  const [payRef, setPayRef] = useState("");
  const { run: createPaymentIntent, loading: gatewayLoading } = useCreatePaymentIntent();
  const { run: confirmPaymentIntent, loading: confirmingIntent } = useConfirmPaymentIntent();
  const [paymentConfig, setPaymentConfig] = useState<{ provider: string; stripe_publishable_key?: string } | null>(null);
  const [gatewayIntent, setGatewayIntent] = useState<PaymentIntent | null>(null);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const { run: confirmOrderMutation, loading: confirming } = useConfirmOrder();
  const { run: confirmCreditMutation, loading: confirmingCredit } = useConfirmOrderCredit();
  const { run: submitPayment, loading: recordingPayment } = useRecordOrderPayment();
  const { run: cancelOrderMutation, loading: cancelling } = useCancelOrder();

  useEffect(() => {
    if (order) setPayAmount(order.total_usd.toFixed(2));
  }, [order]);

  useEffect(() => {
    void paymentsApi.getConfig().then(setPaymentConfig).catch(() => {});
  }, []);

  async function confirmOrder() {
    setActionError("");
    try {
      setOrder(await confirmOrderMutation(params.id));
      toast.push("Pedido confirmado — estoque reservado", "success");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao confirmar");
    }
  }

  async function confirmCredit() {
    setActionError("");
    try {
      setOrder(await confirmCreditMutation(params.id));
      toast.push("Pedido confirmado com crédito B2B — estoque reservado", "success");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao confirmar crédito");
    }
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    setActionError("");
    try {
      const o = await submitPayment({
        id: params.id,
        amount_usd: parseFloat(payAmount) || 0,
        method: payMethod,
        reference: payRef || undefined,
      });
      setOrder(o);
      toast.push(
        o.status === "paid" ? "Pagamento registrado — pedido pago" : "Pagamento parcial registrado",
        "success",
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    }
  }

  async function payViaGateway() {
    setActionError("");
    setGatewayIntent(null);
    try {
      const intent = await createPaymentIntent(params.id);
      if (intent.provider === "stripe") {
        if (!paymentConfig?.stripe_publishable_key) {
          setActionError("Stripe configurado no servidor, mas chave publicável ausente.");
          return;
        }
        setGatewayIntent(intent);
        toast.push("Informe o cartão abaixo para concluir a cobrança.", "info");
        return;
      }
      await confirmPaymentIntent(intent.id);
      await refetch();
      toast.push("Pagamento via gateway confirmado — pedido atualizado", "success");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro no gateway");
    }
  }

  async function confirmGatewayIntent() {
    if (!gatewayIntent) return;
    setActionError("");
    try {
      await confirmPaymentIntent(gatewayIntent.id);
      setGatewayIntent(null);
      await refetch();
      toast.push("Pagamento via Stripe confirmado — pedido atualizado", "success");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao confirmar pagamento");
    }
  }

  async function onShipped() {
    setShipModalOpen(false);
    await refetch();
    toast.push("Pedido expedido — estoque baixado", "success");
  }

  async function cancelOrder() {
    if (!confirm("Cancelar este pedido? Reservas de estoque serão liberadas.")) return;
    setActionError("");
    try {
      setOrder(await cancelOrderMutation(params.id));
      toast.push("Pedido cancelado", "success");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao cancelar");
    }
  }

  const displayError = actionError || error;

  if (loading) return <p className="text-slate-500">Carregando…</p>;
  if (!order) return displayError ? <Alert tone="error">{displayError}</Alert> : null;

  const isB2B = customer?.type === "b2b" || customer?.type === "reseller";
  const canCancelDraft =
    order.status === "draft" &&
    (hasPermission(user, "sales.orders.cancel") || hasPermission(user, "sales.orders.write"));
  const canCancelConfirmed =
    order.status === "confirmed" && hasPermission(user, "sales.orders.cancel");
  const canCancelPaid =
    order.status === "paid" &&
    hasPermission(user, "sales.orders.cancel") &&
    hasPermission(user, "sales.orders.confirm");
  const canCancel = canCancelDraft || canCancelConfirmed || canCancelPaid;
  const canConfirm = order.status === "draft" && hasPermission(user, "sales.orders.confirm");
  const canPay = hasPermission(user, "finance.payments.write");
  const canShip =
    (order.status === "confirmed" || order.status === "paid") &&
    hasPermission(user, "sales.orders.confirm");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/pedidos" className="text-sm text-blue-600 hover:underline">
          ← Pedidos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Pedido {order.order_number}</h1>
		<p className="mt-1 text-sm text-slate-600">
          Status: <strong>{orderStatusLabel(order.status)}</strong> · Origem:{" "}
          <strong>{orderChannelLabel(order.channel)}</strong> · Total:{" "}
          <strong>USD {order.total_usd.toFixed(2)}</strong>
          {customer ? <> · Cliente: <strong>{customer.name}</strong></> : null}
        </p>
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void salesApi
                .orderReceiptHtml(order.id)
                .then(printHTML)
                .catch((err) => setActionError(err instanceof Error ? err.message : "Erro no comprovante"));
            }}
          >
            Imprimir comprovante
          </Button>
        </div>
        {order.quote_id ? (
          <p className="mt-1 text-xs text-slate-500">
            Origem:{" "}
            <Link href={`/cotacoes/${order.quote_id}`} className="text-blue-600 hover:underline">
              cotação
            </Link>
          </p>
        ) : null}
      </header>

      {displayError ? <Alert tone="error">{displayError}</Alert> : null}

      <Card title="Itens">
        <Table
          headers={["SKU ID", "Qtd", "Preço unit.", "Total linha"]}
          rows={(order.items ?? []).map((item) => [
            item.sku_id.slice(0, 8) + "…",
            item.quantity,
            `$${item.unit_price_usd.toFixed(2)}`,
            `$${item.line_total_usd.toFixed(2)}`,
          ])}
        />
      </Card>

      {order.status === "draft" && canConfirm ? (
        <Card title="Confirmar pedido">
          <p className="mb-4 text-sm text-slate-600">
            Confirmação reserva estoque disponível no depósito.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={confirming} onClick={() => void confirmOrder()}>
              {confirming ? "Confirmando…" : "Confirmar (pagamento à vista)"}
            </Button>
            {isB2B ? (
              <Button type="button" variant="secondary" disabled={confirmingCredit} onClick={() => void confirmCredit()}>
                {confirmingCredit ? "Confirmando…" : "Confirmar com crédito B2B"}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {order.status === "draft" && canPay ? (
        <Card title="Registrar pagamento manual">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={recordPayment}>
            <Field label="Valor USD">
              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
            </Field>
            <Field label="Método">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="transfer">Transferência</option>
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão</option>
              </Select>
            </Field>
            <Field label="Referência">
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="opcional" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={recordingPayment}>
                {recordingPayment ? "Registrando…" : "Registrar pagamento"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {(order.status === "confirmed" || order.status === "draft") && canPay ? (
        <Card title="Pagamento via gateway">
          <p className="mb-4 text-sm text-slate-600">
            Provider ativo: <strong>{paymentConfig?.provider ?? "mock"}</strong>
            {paymentConfig?.provider === "stripe"
              ? " — cobrança com cartão via Stripe Elements."
              : " — confirmação imediata em dev."}
          </p>
          {gatewayIntent && paymentConfig?.stripe_publishable_key ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Valor: <strong>USD {gatewayIntent.amount_usd.toFixed(2)}</strong>
              </p>
              <StripePaymentForm
                publishableKey={paymentConfig.stripe_publishable_key}
                clientSecret={gatewayIntent.client_secret}
                onSuccess={confirmGatewayIntent}
                submitLabel={`Cobrar USD ${gatewayIntent.amount_usd.toFixed(2)}`}
              />
              <Button type="button" variant="secondary" onClick={() => setGatewayIntent(null)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button type="button" disabled={gatewayLoading || confirmingIntent} onClick={() => void payViaGateway()}>
              {gatewayLoading ? "Processando…" : "Cobrar via gateway"}
            </Button>
          )}
        </Card>
      ) : null}

      {(order.status === "confirmed" || order.status === "paid") && canShip ? (
        <Card title="Expedição">
          <p className="mb-4 text-sm text-slate-600">
            Fotografe cada item antes de liberar a expedição e baixar o estoque.
          </p>
          <Button type="button" onClick={() => setShipModalOpen(true)}>
            Expedir pedido
          </Button>
        </Card>
      ) : null}

      {order.ship_photos && order.ship_photos.length > 0 ? (
        <OrderShipPhotosGallery orderId={order.id} photos={order.ship_photos} />
      ) : null}

      {canCancel ? (
        <Card title="Cancelamento">
          <p className="mb-4 text-sm text-slate-600">
            {order.status === "paid"
              ? "Cancelamento de pedido pago exige permissão de confirmação (Gerência/Financeiro)."
              : order.status === "confirmed"
                ? "Libera reservas de estoque e cancela título em aberto."
                : "Cancela o rascunho sem impacto no estoque."}
          </p>
          <Button type="button" variant="secondary" disabled={cancelling} onClick={() => void cancelOrder()}>
            {cancelling ? "Cancelando…" : "Cancelar pedido"}
          </Button>
        </Card>
      ) : null}

      {order.confirmed_at ? (
        <p className="text-xs text-slate-500">
          Confirmado em {new Date(order.confirmed_at).toLocaleString("pt-BR")}
        </p>
      ) : null}
      {order.paid_at ? (
        <p className="text-xs text-slate-500">
          Pago em {new Date(order.paid_at).toLocaleString("pt-BR")}
        </p>
      ) : null}

      {shipModalOpen ? (
        <ShipExpeditionModal
          orderId={order.id}
          orderNumber={order.order_number}
          onClose={() => setShipModalOpen(false)}
          onShipped={() => void onShipped()}
        />
      ) : null}
    </div>
  );
}
