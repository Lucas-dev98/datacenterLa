import { Suspense } from "react";
import { ContaPageClient } from "./conta-client";
import { ShopShell } from "@/components/shop-shell";

function ContaFallback() {
  return (
    <ShopShell crumbs={[{ label: "Pedidos" }]}>
      <div className="mx-auto max-w-lg animate-pulse space-y-6 py-4">
        <div className="h-8 w-48 rounded bg-neutral-200" />
        <div className="h-40 rounded-lg bg-neutral-100" />
      </div>
    </ShopShell>
  );
}

export default function ContaPage() {
  return (
    <Suspense fallback={<ContaFallback />}>
      <ContaPageClient />
    </Suspense>
  );
}
