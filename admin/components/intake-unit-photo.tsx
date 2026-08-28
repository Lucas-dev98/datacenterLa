"use client";

import { useEffect, useState } from "react";
import { apiBlob, blobObjectUrl } from "@/lib/api";

type Props = {
  unitId: string;
  alt: string;
  className?: string;
};

export function IntakeUnitPhoto({
  unitId,
  alt,
  className = "h-16 w-16 rounded-lg border border-slate-200 object-cover",
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const blob = await apiBlob(`/api/v1/stock/units/${unitId}/intake-photo/file`);
        if (cancelled) return;
        objectUrl = blobObjectUrl(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [unitId]);

  if (failed) {
    return <span className="text-xs text-slate-400">Sem foto</span>;
  }
  if (!url) {
    return <span className="inline-block h-16 w-16 animate-pulse rounded-lg bg-slate-100" />;
  }
  return <img src={url} alt={alt} className={className} />;
}
