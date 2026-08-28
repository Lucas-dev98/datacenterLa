import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog-browser";
import { ShopShell } from "@/components/shop-shell";

export default function LojaPage() {
  return (
    <ShopShell>
      <Suspense
        fallback={
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-lg bg-white/70 ring-1 ring-neutral-200" />
            ))}
          </div>
        }
      >
        <CatalogBrowser />
      </Suspense>
    </ShopShell>
  );
}
