import { api, apiBlob } from "./client";
import type { InventoryUnit, InventoryUnitReceive } from "../types";
import { DEFAULT_WAREHOUSE_ID } from "../config";

const STOCK = "/api/v1/stock";

export const stockApi = {
  listUnits: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit ?? 100));
    return api<{ items: InventoryUnit[] }>(`${STOCK}/units?${q}`);
  },
  unitByCode: (code: string) =>
    api<InventoryUnit>(`${STOCK}/units/code/${encodeURIComponent(code.toUpperCase())}`),
  availability: (skuId: string, warehouseId = DEFAULT_WAREHOUSE_ID) =>
    api<{ qty_available: number; available?: number }>(
      `${STOCK}/availability?sku_id=${skuId}&warehouse_id=${warehouseId}`,
    ),
  peekNextUnitCodes: (count: number) =>
    api<{ codes: string[] }>(`${STOCK}/units/next-codes?count=${count}`),
};

export type { InventoryUnitReceive };
