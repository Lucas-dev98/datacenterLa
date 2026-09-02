/**
 * @file finance.ts
 * @description /api/v1/sales/finance — recebíveis, pagáveis, margens.
 * @hooks hooks: use-finance-*
 *
 * @see admin/lib/api/README.md
 */

import { api, apiBlob } from "./client";
import type { ReceivableListItem } from "../types";

const BASE = "/api/v1/sales";

export type Payable = {
  id: string;
  supplier_name?: string;
  purchase_order_id?: string;
  po_number?: string;
  description: string;
  amount_usd: number;
  amount_paid_usd: number;
  due_date?: string;
  status: string;
};

export type FinanceSummary = {
  revenue_usd: number;
  cogs_usd: number;
  gross_margin_usd: number;
  gross_margin_pct: number;
  receivables_open_usd: number;
  payables_open_usd: number;
  shipped_orders_count: number;
  import_po_open_count: number;
};

export type OrderMarginRow = {
  order_id: string;
  order_number: string;
  channel: string;
  customer_name: string;
  revenue_usd: number;
  cogs_usd: number;
  margin_usd: number;
  margin_pct: number;
  status: string;
};

export type FinanceDashboard = {
  receivables: ReceivableListItem[];
  receivablesTotal: number;
  payables: Payable[];
  summary: FinanceSummary;
  margins: OrderMarginRow[];
};

export const financeApi = {
  loadDashboard: async (status: string): Promise<FinanceDashboard> => {
    const q = status ? `&status=${encodeURIComponent(status)}` : "";
    const [rec, ap, sum, m] = await Promise.all([
      api<{ items: ReceivableListItem[]; total: number }>(`${BASE}/receivables?limit=50${q}`),
      api<{ items: Payable[] }>(`${BASE}/payables`),
      api<FinanceSummary>(`${BASE}/finance/summary`),
      api<{ items: OrderMarginRow[] }>(`${BASE}/finance/margins?limit=20`),
    ]);
    return {
      receivables: rec.items ?? [],
      receivablesTotal: rec.total,
      payables: ap.items ?? [],
      summary: sum,
      margins: m.items ?? [],
    };
  },
  recordReceivablePayment: (
    id: string,
    body: { amount_usd: number; method: string; reference?: string },
  ) =>
    api(`${BASE}/receivables/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  payPayable: (id: string, body: { amount_usd: number; method: string; reference?: string }) =>
    api(`${BASE}/payables/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  exportMargins: () => apiBlob(`${BASE}/finance/margins/export`),
};
