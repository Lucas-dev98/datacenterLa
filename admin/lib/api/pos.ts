/**
 * @file pos.ts
 * @description /api/v1/sales/pos — PDV balcão, PIX, comprovante.
 * @hooks hooks: use-pdv-bootstrap, use-pos-mutations
 *
 * @see admin/lib/api/README.md
 */

import { api, apiText } from "./client";
import type { Customer, Order, SKU } from "../types";
import type { ExchangeRatesToday } from "../exchange-rates";
import { pimApi } from "./pim";
import { pricingApi } from "./pricing";
import { stockApi } from "./stock";

const BASE = "/api/v1/sales/pos";

export type { ExchangeRatesToday };

export type POSCheckoutResponse = {
  order_id: string;
  order_number: string;
  total_usd: number;
};

export type POSPixInitResponse = {
  order: Order;
  amount_brl: number;
  brl_rate: number;
  copy_paste: string;
  qr_png_base64: string;
  txid: string;
  dev_mode?: boolean;
};

export const posApi = {
  getWalkInCustomer: () => api<Customer>(`${BASE}/walk-in-customer`),
  getExchangeRates: () => api<ExchangeRatesToday>(`${BASE}/exchange-rates`),
  searchCustomers: (q: string) =>
    api<{ items: Customer[] }>(`${BASE}/customers?q=${encodeURIComponent(q)}`),
  checkout: (body: Record<string, unknown>) =>
    api<POSCheckoutResponse>(`${BASE}/checkout`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  orderReceiptHtml: (orderId: string) => apiText(`${BASE}/orders/${orderId}/receipt`),
  pixInit: (body: Record<string, unknown>) =>
    api<POSPixInitResponse>(`${BASE}/pix/init`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  pixConfirm: (orderId: string, body?: { reference?: string; ship_immediately?: boolean }) =>
    api<Order>(`${BASE}/pix/${orderId}/confirm`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  pixCancel: (orderId: string) => api<Order>(`${BASE}/pix/${orderId}/cancel`, { method: "POST" }),
  createCustomer: (body: Record<string, unknown>) =>
    api<Customer>(`${BASE}/customers`, { method: "POST", body: JSON.stringify(body) }),
  uploadDocumentScan: (customerId: string, form: FormData) =>
    api<Customer>(`${BASE}/customers/${customerId}/document-scan`, { method: "POST", body: form }),
  resolveSkuForSale: async (sku: SKU) => {
    const [price, avail] = await Promise.all([
      pricingApi.resolveB2C(sku.id),
      stockApi.availability(sku.id),
    ]);
    return { price, qty_available: avail.qty_available ?? avail.available ?? 0 };
  },
  searchSkus: (term: string) => pimApi.searchSkus(term),
  getSkuByCode: (code: string) => pimApi.getSkuByCode(code),
  getUnitByCode: (code: string) => stockApi.unitByCode(code),
};
