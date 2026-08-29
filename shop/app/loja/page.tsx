import { CatalogBrowser } from "@/components/catalog-browser";
import { ShopShell } from "@/components/shop-shell";

type PageProps = {
  searchParams: Promise<{ q?: string; grupo?: string }>;
};

export default async function LojaPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <ShopShell>
      <CatalogBrowser q={params.q?.trim() ?? ""} grupo={params.grupo?.trim() ?? ""} />
    </ShopShell>
  );
}
