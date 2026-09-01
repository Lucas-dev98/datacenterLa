import Link from "next/link";
import { ShopShell } from "@/components/shop-shell";

export default function ProductNotFound() {
  return (
    <ShopShell crumbs={[{ href: "/loja", label: "Loja" }, { label: "Produto" }]}>
      <p className="text-sm text-neutral-600">Produto não encontrado.</p>
      <Link href="/loja" className="mt-4 inline-block text-sm underline">
        Voltar à loja
      </Link>
    </ShopShell>
  );
}
