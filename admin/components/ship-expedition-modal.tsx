"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, shipOrderWithPhotos } from "@/lib/api";
import type { Order, OrderItem } from "@/lib/types";
import { DocumentScanCapture } from "@/components/document-scan-capture";
import { Alert, Button } from "@/components/ui";

type ItemPhoto = {
  file: File | null;
  preview: string;
};

type Props = {
  orderId: string;
  orderNumber?: string;
  onClose: () => void;
  onShipped: () => void;
};

export function ShipExpeditionModal({ orderId, orderNumber, onClose, onShipped }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [photos, setPhotos] = useState<Record<string, ItemPhoto>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    void api<Order>(`/api/v1/sales/orders/${orderId}`)
      .then((o) => {
        setOrder(o);
        const initial: Record<string, ItemPhoto> = {};
        for (const item of o.items ?? []) {
          initial[item.id] = { file: null, preview: "" };
        }
        setPhotos(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar pedido"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const items = order?.items ?? [];
  const allCaptured = useMemo(
    () => items.length > 0 && items.every((item) => photos[item.id]?.file),
    [items, photos],
  );

  function setItemPhoto(itemId: string, file: File | null) {
    setPhotos((prev) => {
      const current = prev[itemId];
      if (current?.preview) URL.revokeObjectURL(current.preview);
      return {
        ...prev,
        [itemId]: {
          file,
          preview: file ? URL.createObjectURL(file) : "",
        },
      };
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!order || !allCaptured) {
      setError("Fotografe todos os itens antes de liberar a expedição");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      for (const item of items) {
        const file = photos[item.id]?.file;
        if (!file) continue;
        form.append(`photo_${item.id}`, file);
      }
      await shipOrderWithPhotos(order.id, form);
      onShipped();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao expedir pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="ship-expedition-modal">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-modal-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="ship-modal-title" className="text-lg font-semibold text-slate-900">
          Liberar expedição
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Pedido {orderNumber ?? order?.order_number ?? orderId} — fotografe cada item que está saindo.
        </p>

        {error ? (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando itens…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Pedido sem itens para expedir.</p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={onSubmit}>
            {items.map((item) => (
              <ItemPhotoBlock
                key={item.id}
                item={item}
                photo={photos[item.id]}
                onCapture={(file) => setItemPhoto(item.id, file)}
              />
            ))}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={!allCaptured || submitting} data-testid="ship-expedition-submit">
                {submitting ? "Expedindo…" : "Confirmar expedição"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ItemPhotoBlock({
  item,
  photo,
  onCapture,
}: {
  item: OrderItem;
  photo?: ItemPhoto;
  onCapture: (file: File | null) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="font-mono text-sm font-semibold text-slate-900">{item.sku_code ?? item.sku_id}</p>
      {item.sku_name ? <p className="text-sm text-slate-700">{item.sku_name}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        Qtd {item.quantity} · USD {item.line_total_usd.toFixed(2)}
      </p>
      <div className="mt-3">
        <DocumentScanCapture
          label="Foto do item na saída"
          hint="Posicione o produto na frente da webcam e capture a foto."
          preview={photo?.preview ?? ""}
          fileName={photo?.file?.name}
          tone="blue"
          onCapture={onCapture}
        />
      </div>
    </div>
  );
}
