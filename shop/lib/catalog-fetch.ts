import type { EcommerceCategory } from "./types";
import { categoryIdsForGroup } from "./catalog-groups";

/** Resolve server-side catalog fetch options from URL search params. */
export function catalogFetchOpts(
  categories: EcommerceCategory[],
  opts: { q?: string; grupo?: string },
): { q?: string; categoryId?: string } {
  const q = opts.q?.trim();
  const grupo = opts.grupo?.trim() ?? "";
  if (q) return { q };

  const ids = categoryIdsForGroup(categories, grupo);
  if (!ids || ids.size === 0) return {};
  // Backend accepts one category_id; pick first root match for group filter.
  const categoryId = [...ids][0];
  return { categoryId };
}
