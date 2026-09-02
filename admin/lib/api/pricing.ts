/**
 * @file pricing.ts
 * @description /api/v1/pricing — preços USD e câmbio.
 * @hooks hooks: use-pricing-mutations, use-sku-pricing-detail
 *
 * @see admin/lib/api/README.md
 */

import { api } from "./client";
import type { ResolvedPrice, SKUPrice } from "../types";
import type { ExchangeRatesToday } from "../exchange-rates";

const BASE = "/api/v1/pricing";

export type { ResolvedPrice };

export const pricingApi = {
  resolveB2C: (skuId: string) =>
    api<ResolvedPrice>(`${BASE}/skus/${skuId}/resolve?channel=b2c`),
  resolve: (skuId: string, channel: string) =>
    api<ResolvedPrice>(`${BASE}/skus/${skuId}/resolve?channel=${encodeURIComponent(channel)}`),
  getSkuPrice: (skuId: string) => api<SKUPrice>(`${BASE}/skus/${skuId}`),
  setSkuPrice: (skuId: string, body: Record<string, number>) =>
    api(`${BASE}/skus/${skuId}`, { method: "PUT", body: JSON.stringify(body) }),
  exchangeRatesToday: () => api<ExchangeRatesToday>(`${BASE}/exchange-rates/today`),
  syncExchangeRates: () =>
    api<ExchangeRatesToday>(`${BASE}/exchange-rates/sync`, { method: "POST" }),
};
