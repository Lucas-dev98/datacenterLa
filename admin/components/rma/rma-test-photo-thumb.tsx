"use client";

import { useEffect, useState } from "react";
import { blobObjectUrl } from "@/lib/api/client";
import { rmaApi } from "@/lib/api/rma";

export function RMATestPhotoThumb({ caseId, photoId, alt }: { caseId: string; photoId: string; alt: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      try {
        const blob = await rmaApi.testPhotoBlob(caseId, photoId);
        if (cancelled) return;
        objectUrl = blobObjectUrl(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl("");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [caseId, photoId]);

  if (!url) return <span className="inline-block h-16 w-16 rounded-lg bg-slate-100" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
    </a>
  );
}
