import { Storefront } from "@/components/storefront";
import { FEATURED_CODES, HOME_PART_CODES } from "@/lib/storefront-data";
import { fetchCatalogServer } from "@/lib/server-api";
import type { CatalogProduct } from "@/lib/types";

function pickByCode(catalog: CatalogProduct[], code: string) {
  return catalog.find((p) => p.sku_code === code);
}

export default async function HomePage() {
  const catalog = await fetchCatalogServer();

  const featuredModels = FEATURED_CODES.map((code) => pickByCode(catalog, code)).filter(
    (p): p is CatalogProduct => Boolean(p),
  );
  const featured = catalog.filter((p) => p.available > 0).slice(0, 6);

  return (
    <>
      <link
        rel="preload"
        href="/brand/hero-aisle.webp"
        as="image"
        type="image/webp"
        fetchPriority="high"
      />
      <Storefront
        featuredModels={featuredModels}
        featured={featured}
        partCPU={pickByCode(catalog, HOME_PART_CODES.cpu)}
        partRAM={pickByCode(catalog, HOME_PART_CODES.ram)}
        partSSD={pickByCode(catalog, HOME_PART_CODES.ssd)}
      />
    </>
  );
}
