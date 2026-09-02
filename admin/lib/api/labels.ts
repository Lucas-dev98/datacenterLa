/**
 * @file labels.ts
 * @description /api/v1/labels — etiquetas de gaveta PDF/HTML.
 * @hooks hooks: use-label-mutations
 *
 * @see admin/lib/api/README.md
 */

import { apiBlob } from "./client";

const BASE = "/api/v1/labels";

export const labelsApi = {
  batch: (body: { format: "pdf" | "html"; items: { type: string; code: string }[] }) =>
    apiBlob(`${BASE}/batch`, { method: "POST", body: JSON.stringify(body) }),
};
