import { api } from "./client";
import type { FeedDiagnostics, FeedSyncLog, FeedSyncLogDetail } from "../types";

const BASE = "/api/v1/integrations/compras-paraguai";

export const integrationsApi = {
  listSyncLogs: (limit = 30) =>
    api<{ items: FeedSyncLog[] }>(`${BASE}/sync/logs?limit=${limit}`),
  getSyncDiagnostics: () => api<FeedDiagnostics>(`${BASE}/sync/diagnostics`),
  runSync: () => api(`${BASE}/sync/run`, { method: "POST" }),
  getSyncLog: (id: string) => api<FeedSyncLogDetail>(`${BASE}/sync/logs/${id}`),
};
