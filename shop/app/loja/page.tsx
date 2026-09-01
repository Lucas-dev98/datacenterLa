import { CatalogBrowser } from "@/components/catalog-browser";
import { ShopShell } from "@/components/shop-shell";
import { catalogFetchOpts } from "@/lib/catalog-fetch";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { fetchCatalogServer, fetchCategoriesServer } from "@/lib/server-api";

type PageProps = {
  searchParams: Promise<{ q?: string; grupo?: string }>;
};

export default async function LojaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const grupo = params.grupo?.trim() ?? "";

  const initialCategories = await fetchCategoriesServer();
  const fetchOpts = catalogFetchOpts(initialCategories, { q, grupo });
  const initialProducts = await fetchCatalogServer(DEFAULT_WAREHOUSE_ID, fetchOpts);

  return (
    <ShopShell>
      <CatalogBrowser
        q={q}
        grupo={grupo}
        initialProducts={initialProducts}
        initialCategories={initialCategories}
      />
    </ShopShell>
  );
}
