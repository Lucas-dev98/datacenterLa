export type QrPayload =
  | { kind: "unit"; code: string; sku?: string }
  | { kind: "sku"; code: string };

export function normalizeSkuCode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.trim();
  return digits.padStart(6, "0");
}

/** Interpreta conteúdo de etiqueta QR (JSON ou código plano). */
export function parseQrPayload(raw: string): QrPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const data = JSON.parse(trimmed) as { type?: string; code?: string; sku?: string };
    if (data.type === "unit" && data.code) {
      return {
        kind: "unit",
        code: String(data.code).trim().toUpperCase(),
        sku: data.sku ? normalizeSkuCode(String(data.sku)) : undefined,
      };
    }
    if (data.type === "sku" && data.code) {
      return { kind: "sku", code: normalizeSkuCode(String(data.code)) };
    }
  } catch {
    /* texto plano */
  }

  const upper = trimmed.toUpperCase();
  if (/^AAA\d{4,}$/.test(upper)) {
    return { kind: "unit", code: upper };
  }
  if (/^\d{1,6}$/.test(trimmed)) {
    return { kind: "sku", code: normalizeSkuCode(trimmed) };
  }

  return null;
}
