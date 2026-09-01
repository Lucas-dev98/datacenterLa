"use client";

import { useState } from "react";
import { usePosPixCancel, usePosPixConfirm } from "@/hooks/use-pos-mutations";
import type { POSPixInitResponse } from "@/lib/api/pos";
import type { Order } from "@/lib/types";
import { Alert, Button, Field, Input } from "@/components/ui";

export type { POSPixInitResponse };

type Props = {
  data: POSPixInitResponse;
  shipImmediately: boolean;
  onConfirmed: (order: Order) => void;
  onCancelled: () => void;
};

export function PDVPixModal({ data, shipImmediately, onConfirmed, onCancelled }: Props) {
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { run: confirmPix, loading: confirming, setError: setConfirmError } = usePosPixConfirm();
  const { run: cancelPix, loading: cancelling, setError: setCancelError } = usePosPixCancel();

  async function copyPaste() {
    try {
      await navigator.clipboard.writeText(data.copy_paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar — selecione o texto manualmente.");
    }
  }

  async function confirmPayment() {
    setError("");
    setConfirmError("");
    try {
      const order = await confirmPix({
        orderId: data.order.id,
        reference: reference.trim() || undefined,
        ship_immediately: shipImmediately,
      });
      onConfirmed(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar PIX");
    }
  }

  async function cancelSale() {
    if (!window.confirm("Cancelar esta venda e liberar o estoque reservado?")) return;
    setError("");
    setCancelError("");
    try {
      await cancelPix(data.order.id);
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar venda");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="pix-modal-title" className="text-lg font-semibold text-slate-900">
          Pagamento PIX
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Pedido {data.order.order_number} · aguardando pagamento
        </p>

        {data.dev_mode ? (
          <Alert tone="warning" className="mt-3">
            Modo desenvolvimento — configure <code className="text-xs">PIX_KEY</code> no backend para
            QR de produção.
          </Alert>
        ) : null}

        {error ? (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        ) : null}

        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-center">
          <p className="text-sm text-emerald-800">Valor a receber</p>
          <p className="text-3xl font-bold text-emerald-900">
            R$ {data.amount_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            US$ {data.order.total_usd.toFixed(2)} × cotação R$ {data.brl_rate.toFixed(4)}
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          <img
            src={`data:image/png;base64,${data.qr_png_base64}`}
            alt="QR Code PIX"
            className="h-56 w-56 rounded-lg border border-slate-200"
          />
        </div>

        <Field label="PIX copia e cola" hint="Cliente pode colar no app do banco">
          <textarea
            readOnly
            rows={3}
            value={data.copy_paste}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800"
          />
        </Field>
        <Button type="button" variant="secondary" className="mt-2 w-full" onClick={() => void copyPaste()}>
          {copied ? "Copiado!" : "Copiar código PIX"}
        </Button>

        <div className="mt-4">
          <Field
            label="ID da transação (opcional)"
            hint="E2E ID ou comprovante — gravado na venda após confirmação"
          >
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="E2E, NSU, etc."
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            disabled={confirming || cancelling}
            onClick={() => void confirmPayment()}
          >
            {confirming ? "Confirmando…" : "Confirmar recebimento"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={confirming || cancelling}
            onClick={() => void cancelSale()}
          >
            {cancelling ? "Cancelando…" : "Cancelar venda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
