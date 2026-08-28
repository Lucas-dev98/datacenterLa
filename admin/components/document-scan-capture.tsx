"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  label: string;
  hint: string;
  preview: string;
  fileName?: string;
  tone?: "blue" | "amber" | "slate";
  onCapture: (file: File | null) => void;
};

type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

export function DocumentScanCapture({
  label,
  hint,
  preview,
  fileName,
  tone = "slate",
  onCapture,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const boxClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  const titleClass =
    tone === "blue" ? "text-blue-900" : tone === "amber" ? "text-amber-900" : "text-slate-900";

  const hintClass =
    tone === "blue" ? "text-blue-800" : tone === "amber" ? "text-amber-800" : "text-slate-600";

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const closeCamera = useCallback(() => {
    stopStream();
    setCameraOpen(false);
  }, [stopStream]);

  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;

    async function run() {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Seu navegador não suporta acesso à câmera.");
        setCameraOpen(false);
        return;
      }

      stopStream();

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setCameraReady(true);

        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all
          .filter((d) => d.kind === "videoinput")
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Câmera ${index + 1}`,
          }));
        setDevices(cams);
        if (cams.length > 0 && !deviceId) setDeviceId(cams[0].deviceId);
      } catch (err) {
        if (cancelled) return;
        setCameraOpen(false);
        setCameraError(
          err instanceof Error
            ? err.name === "NotAllowedError"
              ? "Permita o acesso à câmera no navegador."
              : err.message
            : "Não foi possível abrir a câmera.",
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [cameraOpen, deviceId, stopStream]);

  useEffect(() => {
    return () => closeCamera();
  }, [closeCamera]);

  function pickFromInput(input: HTMLInputElement | null) {
    const file = input?.files?.[0] ?? null;
    onCapture(file);
    if (input) input.value = "";
  }

  function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("Aguarde a câmera carregar antes de capturar.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Falha ao capturar a foto.");
          return;
        }
        const file = new File([blob], `item-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        closeCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${boxClass}`}>
      <p className={`text-sm font-medium ${titleClass}`}>{label}</p>
      <p className={`mt-1 text-xs ${hintClass}`}>{hint}</p>

      {cameraError ? <p className="mt-2 text-xs text-red-700">{cameraError}</p> : null}

      {!cameraOpen ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setCameraOpen(true)}>
            Usar câmera conectada
          </Button>
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            Escolher arquivo
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onCapture(null);
                setCameraError("");
              }}
            >
              Remover
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {devices.length > 1 ? (
            <label className="block text-xs text-slate-700">
              Câmera
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="overflow-hidden rounded-md border border-slate-300 bg-black">
            <video ref={videoRef} className="aspect-video w-full object-contain" playsInline muted autoPlay />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={captureFromCamera} disabled={!cameraReady}>
              Capturar foto
            </Button>
            <Button type="button" variant="secondary" onClick={closeCamera}>
              Fechar câmera
            </Button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={() => pickFromInput(fileRef.current)}
      />

      {fileName ? <p className="mt-2 text-xs text-slate-600">Anexo: {fileName}</p> : null}

      {preview && !cameraOpen ? (
        <img
          src={preview}
          alt="Foto capturada"
          className="mt-3 max-h-48 w-full rounded-md border object-contain bg-white"
        />
      ) : !cameraOpen ? (
        <p className="mt-2 text-xs text-slate-500">Nenhuma foto anexada ainda.</p>
      ) : null}
    </div>
  );
}
