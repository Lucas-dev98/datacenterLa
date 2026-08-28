import type { CatalogProduct, EcommerceCategory } from "./types";

export type CatalogGroup = "servidores" | "storages" | "switch" | "componentes";

export const CATALOG_GROUPS: Record<
  CatalogGroup,
  { label: string; href: string; parentCodes: string[] }
> = {
  servidores: { label: "Servidores", href: "/loja?grupo=servidores", parentCodes: ["SERVIDOR"] },
  storages: { label: "Storages", href: "/loja?grupo=storages", parentCodes: ["STORAGE"] },
  switch: { label: "Switch", href: "/loja?grupo=switch", parentCodes: ["SWITCH"] },
  componentes: {
    label: "Componentes",
    href: "/loja?grupo=componentes",
    parentCodes: ["SSD", "HDD", "GPU", "PLACA_REDE", "MEMORIA", "PROCESSADOR", "FONTE"],
  },
};

export function categoryIdsForGroup(categories: EcommerceCategory[], group: string): Set<string> | null {
  const spec = CATALOG_GROUPS[group as CatalogGroup];
  if (!spec) return null;
  const parentIds = new Set(categories.filter((c) => spec.parentCodes.includes(c.code)).map((c) => c.id));
  const ids = new Set(parentIds);
  for (const c of categories) {
    if (c.parent_id && ids.has(c.parent_id)) ids.add(c.id);
  }
  return ids;
}

export function productInGroup(
  product: CatalogProduct,
  categories: EcommerceCategory[],
  group: string,
): boolean {
  const ids = categoryIdsForGroup(categories, group);
  if (!ids) return true;
  return product.category_id ? ids.has(product.category_id) : false;
}
