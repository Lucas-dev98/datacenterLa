import { Storefront } from "@/components/storefront";
import { ApiStatusBanner } from "@/components/api-status-banner";
import {
  DEFAULT_FEATURED_CODES,
  emptyStorefrontPage,
  mergeStorefrontContent,
  pickParts,
} from "@/lib/storefront-defaults";
import { fetchCatalogByCodesServer, fetchStorefrontServer } from "@/lib/server-api";

export default async function HomePage() {
  const remote = await fetchStorefrontServer();
  const apiDegraded = remote === null;
  const base = remote ?? emptyStorefrontPage();

  let featuredModels = base.featured_models ?? [];
  if (featuredModels.length === 0) {
    featuredModels = await fetchCatalogByCodesServer(DEFAULT_FEATURED_CODES);
  }

  let parts = base.parts ?? {};
  if (!parts.cpu && !parts.ram) {
    const partProducts = await fetchCatalogByCodesServer([
      "000076",
      "000032",
      "000006",
    ]);
    parts = { ...parts, ...pickParts(partProducts) };
  }

  const page = {
    ...base,
    content: mergeStorefrontContent(base.content),
    featured_models: featuredModels,
    parts,
  };

  return (
    <>
      <link
        rel="preload"
        href="/brand/hero-aisle.webp"
        as="image"
        type="image/webp"
        fetchPriority="high"
      />
      {apiDegraded ? <ApiStatusBanner /> : null}
      <Storefront
        content={page.content}
        featuredModels={page.featured_models}
        featured={page.featured ?? []}
        partCPU={page.parts?.cpu}
        partRAM={page.parts?.ram}
      />
    </>
  );
}
