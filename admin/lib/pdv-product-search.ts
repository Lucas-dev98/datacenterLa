import { pimApi } from "@/lib/api/pim";
import { stockApi } from "@/lib/api/stock";
import type { SKU } from "@/lib/types";

/** Busca SKUs para o PDV: código AAA, SKU numérico ou texto livre. */
export async function searchPdvSkus(term: string): Promise<SKU[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const out: SKU[] = [];
  const push = (sku: SKU | null | undefined) => {
    if (!sku?.id || !sku.is_active || seen.has(sku.id)) return;
    seen.add(sku.id);
    out.push(sku);
  };

  if (/^AAA\d+$/i.test(trimmed)) {
    const unit = await stockApi.unitByCode(trimmed).catch(() => null);
    if (unit?.sku_id) {
      const sku = await pimApi.getSku(unit.sku_id).catch(() => null);
      push(sku);
    }
  }

  if (/^\d{1,6}$/.test(trimmed)) {
    const byCode = await pimApi.getSkuByCode(trimmed).catch(() => null);
    push(byCode);
  }

  const res = await pimApi.searchSkus(trimmed);
  for (const sku of res.items ?? []) push(sku);
  return out;
}
