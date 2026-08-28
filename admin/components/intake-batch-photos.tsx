"use client";

import { useEffect, useState } from "react";
import { api, apiBlob, blobObjectUrl } from "@/lib/api";
import type { IntakeBatchPhoto } from "@/lib/types";
import { DocumentScanCapture } from "@/components/document-scan-capture";

type Props = {
  batchId: string;
  label?: string;
};

export function IntakeBatchPhotoGallery({ batchId, label = "Fotos do lote" }: Props) {
  const [photos, setPhotos] = useState<IntakeBatchPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ items: IntakeBatchPhoto[] }>(
          `/api/v1/stock/intake-batches/${batchId}/photos`,
        );
        if (!cancelled) setPhotos(res.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar fotos");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    void (async () => {
      const next: Record<string, string> = {};
      for (const photo of photos) {
        try {
          const blob = await apiBlob(
            `/api/v1/stock/intake-batches/${batchId}/photos/${photo.id}/file`,
          );
          if (cancelled) return;
          const url = blobObjectUrl(blob);
          created.push(url);
          next[photo.id] = url;
        } catch {
          /* skip broken photo */
        }
      }
      if (!cancelled) setUrls(next);
    })();

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [batchId, photos]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">
        {label} ({photos.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) =>
          urls[photo.id] ? (
            <a
              key={photo.id}
              href={urls[photo.id]}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={urls[photo.id]}
                alt={`Foto lote ${photo.sort_order + 1}`}
                className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
              />
            </a>
          ) : (
            <span key={photo.id} className="inline-block h-20 w-20 animate-pulse rounded-lg bg-slate-100" />
          ),
        )}
      </div>
    </div>
  );
}

type ThumbProps = {
  batchId?: string;
  unitId: string;
  alt: string;
};

export function IntakePhotoThumb({ batchId, unitId, alt }: ThumbProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        if (batchId) {
          const res = await api<{ items: IntakeBatchPhoto[] }>(
            `/api/v1/stock/intake-batches/${batchId}/photos`,
          );
          const first = res.items?.[0];
          if (!first) return;
          const blob = await apiBlob(
            `/api/v1/stock/intake-batches/${batchId}/photos/${first.id}/file`,
          );
          if (cancelled) return;
          objectUrl = blobObjectUrl(blob);
          setUrl(objectUrl);
          return;
        }
        const blob = await apiBlob(`/api/v1/stock/units/${unitId}/intake-photo/file`);
        if (cancelled) return;
        objectUrl = blobObjectUrl(blob);
        setUrl(objectUrl);
      } catch {
        /* no photo */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [batchId, unitId]);

  if (!url) return <span className="text-xs text-slate-400">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
    </a>
  );
}

type UploaderVariant = "intake" | "rma" | "returns";

type UploaderProps = {
  photos: BatchPhotoDraft[];
  maxPhotos?: number;
  variant?: UploaderVariant;
  onChange: (photos: BatchPhotoDraft[]) => void;
};

export type BatchPhotoDraft = {
  file: File;
  preview: string;
};

const UPLOADER_COPY: Record<
  UploaderVariant,
  { photoLabel: string; hint: string; footer: string; limitReached: string }
> = {
  intake: {
    photoLabel: "Foto do lote",
    hint: "Use a câmera conectada para fotografar o conjunto de peças, ou envie um arquivo.",
    footer:
      "Fotografe o conjunto de peças que estão entrando (caixa aberta, pilha de unidades, etc.). Mínimo 1 foto, máximo {max}.",
    limitReached: "Limite de {max} fotos do lote atingido.",
  },
  rma: {
    photoLabel: "Evidência do teste",
    hint: "Fotografe o equipamento em bancada, tela de erro ou resultado do teste — ou envie um arquivo.",
    footer:
      "Anexe ao menos 1 foto comprovando o teste realizado. Máximo {max} fotos por caso.",
    limitReached: "Limite de {max} evidências atingido.",
  },
  returns: {
    photoLabel: "Foto do produto",
    hint: "Fotografe a peça e a embalagem na devolução — ou envie um arquivo.",
    footer: "Opcional — até {max} fotos para conferência na recepção.",
    limitReached: "Limite de {max} fotos atingido.",
  },
};

export function BatchPhotoUploader({
  photos,
  maxPhotos = 5,
  variant = "intake",
  onChange,
}: UploaderProps) {
  const copy = UPLOADER_COPY[variant];

  function addFile(file: File) {
    if (photos.length >= maxPhotos) return;
    onChange([...photos, { file, preview: URL.createObjectURL(file) }]);
  }

  function removeAt(index: number) {
    onChange(
      photos.filter((_, i) => {
        if (i === index) URL.revokeObjectURL(photos[i].preview);
        return i !== index;
      }),
    );
  }

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className="space-y-3" data-testid={`photo-uploader-${variant}`}>
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div key={photo.preview} className="relative">
              <img
                src={photo.preview}
                alt={`${copy.photoLabel} ${index + 1}`}
                className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
              />
              <button
                type="button"
                className="absolute -right-2 -top-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-xs text-white"
                onClick={() => removeAt(index)}
                aria-label={`Remover foto ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {canAddMore ? (
        <DocumentScanCapture
          key={photos.length}
          label={`${copy.photoLabel} ${photos.length + 1}${maxPhotos > 1 ? ` (até ${maxPhotos})` : ""}`}
          hint={copy.hint}
          tone="blue"
          preview=""
          onCapture={(file) => {
            if (file) addFile(file);
          }}
        />
      ) : (
        <p className="text-xs text-emerald-700">{copy.limitReached.replace("{max}", String(maxPhotos))}</p>
      )}

      <p className="text-xs text-slate-500">
        {copy.footer.replace("{max}", String(maxPhotos))}{" "}
        {photos.length > 0 ? `${photos.length} anexada(s).` : ""}
      </p>
    </div>
  );
}
