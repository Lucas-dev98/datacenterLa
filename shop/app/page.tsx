import { Storefront } from "@/components/storefront";
import { fetchStorefrontServer } from "@/lib/server-api";

export default async function HomePage() {
  const page = await fetchStorefrontServer();

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
        content={page?.content}
        featuredModels={page?.featured_models ?? []}
        featured={page?.featured ?? []}
        partCPU={page?.parts?.cpu}
        partRAM={page?.parts?.ram}
        partSSD={page?.parts?.ssd}
      />
    </>
  );
}
