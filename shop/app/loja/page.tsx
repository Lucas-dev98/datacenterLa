import { CatalogBrowser } from "@/components/catalog-browser";
import { ShopShell } from "@/components/shop-shell";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { fetchCatalogServer, fetchCategoriesServer } from "@/lib/server-api";

type PageProps = {
  searchParams: Promise<{ q?: string; grupo?: string }>;
};

export default async function LojaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [initialProducts, initialCategories] = await Promise.all([
    fetchCatalogServer(DEFAULT_WAREHOUSE_ID),
    fetchCategoriesServer(),
  ]);

  return (
    <ShopShell>
      <CatalogBrowser
        q={params.q?.trim() ?? ""}
        grupo={params.grupo?.trim() ?? ""}
        initialProducts={initialProducts}
        initialCategories={initialCategories}
      />
    </ShopShell>
  );
}
