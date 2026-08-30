"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  onScan: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function QrScanner({ onScan, disabled, className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const lastScanRef = useRef({ text: "", at: 0 });
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  const emitScan = useCallback(
    (text: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (text === last.text && now - last.at < 1500) return;
      lastScanRef.current = { text, at: now };
      onScan(text);
    },
    [onScan],
  );

  const stopStream = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!window.BarcodeDetector) {
      setError("Leitura por câmera não suportada neste navegador. Use o campo de código ou um leitor USB.");
      return;
    }
    setError("");
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);

      const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          frameRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const hit = codes.find((c) => c.rawValue?.trim());
          if (hit?.rawValue) emitScan(hit.rawValue.trim());
        } catch {
          /* frame skip */
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a câmera");
      stopStream();
    }
  }, [emitScan, stopStream]);

  useEffect(() => {
    if (disabled && cameraOn) stopStream();
  }, [disabled, cameraOn, stopStream]);

  useEffect(() => stopStream, [stopStream]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {cameraOn ? (
          <Button type="button" variant="secondary" onClick={stopStream} disabled={disabled}>
            Parar câmera
          </Button>
        ) : (
          <Button type="button" onClick={() => void startCamera()} disabled={disabled || !supported}>
            Ler QR code
          </Button>
        )}
        <p className="text-xs text-slate-500">
          {supported
            ? "Aponte para a etiqueta da unidade (AAA) ou do SKU."
            : "Use o campo abaixo ou um leitor USB — a câmera QR não está disponível neste navegador."}
        </p>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div
        className={`relative mt-3 overflow-hidden rounded-lg bg-slate-950 ${cameraOn ? "aspect-[4/3] max-h-72" : "hidden"}`}
      >
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/40" />
      </div>
    </div>
  );
}
