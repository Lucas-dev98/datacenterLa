import { api } from "./client";

const BASE = "/api/v1/pricing";

export type ResolvedPrice = {
  base_price_usd: number;
  price_with_iva_usd?: number;
  price_pyg?: number;
  price_with_iva_pyg?: number;
};

export const pricingApi = {
  resolveB2C: (skuId: string) =>
    api<ResolvedPrice>(`${BASE}/skus/${skuId}/resolve?channel=b2c`),
};
