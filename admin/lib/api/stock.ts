import { receiveIntakeWithPhotos, updateSupplierReturnStatus } from "../api";
import { api, apiBlob } from "./client";
import type {
  InventoryUnit,
  InventoryUnitDetail,
  InventoryUnitReceive,
  IntakeQueueItem,
  LowStockSKU,
  StockBalanceRow,
  StockMovementRow,
} from "../types";
import { DEFAULT_WAREHOUSE_ID } from "../config";

const STOCK = "/api/v1/stock";

export type StockCountLine = {
  sku_code?: string;
  unit_code?: string;
  system_qty: number;
  counted_qty?: number;
  variance: number;
};

export type StockCount = {
  id: string;
  warehouse_id: string;
  status: string;
  count_type: string;
  created_at: string;
  lines?: StockCountLine[];
};

export type StockAdjustment = {
  id: string;
  sku_code?: string;
  quantity_delta: number;
  reason: string;
  status: string;
};

export type SupplierReturn = {
  id: string;
  supplier_name?: string;
  po_number?: string;
  unit_code?: string;
  sku_code?: string;
  reason: string;
  status: string;
  created_at: string;
};

export type HealthStats = {
  total_units: number;
  available_units: number;
  reserved_units: number;
  open_issues: number;
  expiring_reservations: number;
  low_stock_skus: number;
  units_by_status: Record<string, number>;
};

export type ExpiringReservation = {
  id: string;
  order_id: string;
  order_number?: string;
  sku_code: string;
  expires_at: string;
};

export type HealthIssue = {
  id: string;
  issue_type: string;
  status: string;
  unit_code?: string;
  sku_code?: string;
  detected_at: string;
};

export const stockApi = {
  listUnits: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit ?? 100));
    return api<{ items: InventoryUnit[] }>(`${STOCK}/units?${q}`);
  },
  unitByCode: (code: string) =>
    api<InventoryUnit & { status?: string; Status?: string }>(
      `${STOCK}/units/code/${encodeURIComponent(code.toUpperCase())}`,
    ),
  unitDetailByCode: (code: string) =>
    api<InventoryUnitDetail>(`${STOCK}/units/code/${encodeURIComponent(code.toUpperCase())}`),
  unitLabelPdf: (code: string) =>
    apiBlob(`${STOCK}/units/code/${encodeURIComponent(code)}/label?format=pdf`),
  availability: (skuId: string, warehouseId = DEFAULT_WAREHOUSE_ID) =>
    api<{ qty_available: number; available?: number }>(
      `${STOCK}/availability?sku_id=${skuId}&warehouse_id=${warehouseId}`,
    ),
  peekNextUnitCodes: (count: number) =>
    api<{ codes: string[] }>(`${STOCK}/units/next-codes?count=${count}`),
  listMovements: (params: {
    warehouse_id?: string;
    q?: string;
    movement_type?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams({
      warehouse_id: params.warehouse_id ?? DEFAULT_WAREHOUSE_ID,
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
    });
    if (params.q?.trim()) q.set("q", params.q.trim());
    if (params.movement_type) q.set("movement_type", params.movement_type);
    return api<{ items: StockMovementRow[]; total: number }>(`${STOCK}/movements?${q}`);
  },
  listBalances: (params?: { warehouse_id?: string; q?: string; limit?: number }) => {
    const q = new URLSearchParams({
      warehouse_id: params?.warehouse_id ?? DEFAULT_WAREHOUSE_ID,
      limit: String(params?.limit ?? 100),
    });
    if (params?.q?.trim()) q.set("q", params.q.trim());
    return api<{ items: StockBalanceRow[]; total: number }>(`${STOCK}/balances?${q}`);
  },
  listLowStock: (params?: { threshold?: number; q?: string; limit?: number }) => {
    const q = new URLSearchParams({
      threshold: String(params?.threshold ?? 2),
      limit: String(params?.limit ?? 200),
    });
    if (params?.q?.trim()) q.set("q", params.q.trim());
    return api<{ items: LowStockSKU[]; total: number; threshold: number }>(`${STOCK}/low-stock?${q}`);
  },
  healthDashboard: () =>
    api<{
      stats: HealthStats;
      expiring_reservations: ExpiringReservation[];
      open_issues: HealthIssue[];
    }>(`${STOCK}/health/dashboard`),
  healthScan: () => api<{ detected: number }>(`${STOCK}/health/scan`, { method: "POST" }),
  resolveHealthIssue: (id: string, notes = "Resolvido manualmente") =>
    api(`${STOCK}/health/issues/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  intakeQueue: (warehouseId = DEFAULT_WAREHOUSE_ID, limit = 200) =>
    api<{ items: IntakeQueueItem[] }>(`${STOCK}/intake/queue?warehouse_id=${warehouseId}&limit=${limit}`),
  intakeAdvance: (body: { unit_id: string; location_id?: string }) =>
    api<{ unit: InventoryUnit }>(`${STOCK}/intake/advance`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  intakeComplete: (body: { unit_ids: string[]; location_id?: string }) =>
    api<{
      unit?: InventoryUnit;
      completed?: InventoryUnit[];
      failed?: { unit_id: string; error: string }[];
    }>(`${STOCK}/intake/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  receiveIntakeWithPhotos: (form: FormData) => receiveIntakeWithPhotos(form),
  listSupplierReturns: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return api<{ items: SupplierReturn[] }>(`${STOCK}/supplier-returns${qs}`);
  },
  updateSupplierReturnStatus: (id: string, status: "sent" | "closed" | "cancelled") =>
    updateSupplierReturnStatus(id, status),
  listCounts: () => api<{ items: StockCount[] }>(`${STOCK}/counts`),
  getCount: (id: string) => api<StockCount>(`${STOCK}/counts/${id}`),
  createCount: (body: { warehouse_id: string; count_type: string }) =>
    api<StockCount>(`${STOCK}/counts`, { method: "POST", body: JSON.stringify(body) }),
  startCount: (id: string) => api(`${STOCK}/counts/${id}/start`, { method: "POST" }),
  addCountLine: (id: string, body: { unit_code?: string; sku_id?: string; counted_qty?: number }) =>
    api<StockCount>(`${STOCK}/counts/${id}/lines`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeCount: (id: string) => api(`${STOCK}/counts/${id}/complete`, { method: "POST" }),
  approveCount: (id: string) => api<StockCount>(`${STOCK}/counts/${id}/approve`, { method: "POST" }),
  listAdjustments: () => api<{ items: StockAdjustment[] }>(`${STOCK}/adjustments`),
  createAdjustment: (body: {
    warehouse_id: string;
    sku_id: string;
    quantity_delta: number;
    reason: string;
  }) => api(`${STOCK}/adjustments`, { method: "POST", body: JSON.stringify(body) }),
  approveAdjustment: (id: string) => api(`${STOCK}/adjustments/${id}/approve`, { method: "POST" }),
  applyAdjustment: (id: string) => api(`${STOCK}/adjustments/${id}/apply`, { method: "POST" }),
};

export type { InventoryUnitReceive };
