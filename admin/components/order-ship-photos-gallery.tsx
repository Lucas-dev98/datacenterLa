"use client";

import { useEffect, useState } from "react";
import { apiBlob, blobObjectUrl } from "@/lib/api";
import type { OrderShipPhoto } from "@/lib/types";
import { Card } from "@/components/ui";

type Props = {
  orderId: string;
  photos: OrderShipPhoto[];
};

export function OrderShipPhotosGallery({ orderId, photos }: Props) {
  if (photos.length === 0) return null;

  return (
    <Card title="Fotos da expedição">
      <p className="mb-4 text-sm text-slate-600">
        Registro visual dos itens entregues ao cliente no momento da liberação.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <ShipPhotoTile key={photo.id} orderId={orderId} photo={photo} />
        ))}
      </div>
    </Card>
  );
}

function ShipPhotoTile({ orderId, photo }: { orderId: string; photo: OrderShipPhoto }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void apiBlob(`/api/v1/sales/orders/${orderId}/ship-photos/${photo.id}/file`)
      .then((blob) => {
        if (!active) return;
        objectUrl = blobObjectUrl(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, photo.id]);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="font-mono text-sm font-semibold text-slate-900">{photo.sku_code ?? photo.sku_id}</p>
      {photo.sku_name ? <p className="text-sm text-slate-700">{photo.sku_name}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        {new Date(photo.created_at).toLocaleString("pt-BR")}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600">Não foi possível carregar a foto.</p>
      ) : src ? (
        <img
          src={src}
          alt={`Expedição ${photo.sku_code ?? photo.sku_id}`}
          className="mt-3 max-h-56 w-full rounded-md border object-contain bg-slate-50"
        />
      ) : (
        <p className="mt-3 text-sm text-slate-500">Carregando foto…</p>
      )}
    </div>
  );
}
