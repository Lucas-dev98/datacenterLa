import { Storefront } from "@/components/storefront";
import { FEATURED_CODES, HOME_PART_CODES } from "@/lib/storefront-data";
import { fetchCatalogByCodesServer, fetchCatalogServer } from "@/lib/server-api";
import type { CatalogProduct } from "@/lib/types";

export default async function HomePage() {
  const codes = [
    ...FEATURED_CODES,
    HOME_PART_CODES.cpu,
    HOME_PART_CODES.ram,
    HOME_PART_CODES.ssd,
  ];
  const [picked, catalog] = await Promise.all([
    fetchCatalogByCodesServer(codes),
    fetchCatalogServer(),
  ]);

  const byCode = (code: string) => picked.find((p) => p.sku_code === code);
  const featuredModels = FEATURED_CODES.map((code) => byCode(code)).filter(
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
        partCPU={byCode(HOME_PART_CODES.cpu)}
        partRAM={byCode(HOME_PART_CODES.ram)}
        partSSD={byCode(HOME_PART_CODES.ssd)}
      />
    </>
  );
}
