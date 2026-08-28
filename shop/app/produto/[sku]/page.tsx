"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { addToCart, fetchProduct } from "@/lib/api";
import { formatPyg, formatUsd } from "@/lib/format";
import { catalogImageUrl } from "@/lib/product-image";
import { getSessionId } from "@/lib/session";
import type { CatalogProduct } from "@/lib/types";
import { ShopShell } from "@/components/shop-shell";
import { MediaFrame } from "@/components/media-frame";
import { Alert, Button } from "@/components/ui";

export default function ProductPage() {
  const params = useParams<{ sku: string }>();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setProduct(await fetchProduct(params.sku));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Produto não encontrado");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.sku]);

  async function add() {
    if (!product) return;
    try {
      await addToCart(getSessionId(), product.sku_id, 1);
      setInfo("Adicionado ao carrinho.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  if (loading) {
    return (
      <ShopShell crumbs={[{ href: "/loja", label: "Loja" }, { label: "…" }]}>
        <p className="text-sm text-neutral-500">Carregando produto…</p>
      </ShopShell>
    );
  }
  if (!product) {
    return (
      <ShopShell crumbs={[{ href: "/loja", label: "Loja" }, { label: "Produto" }]}>
        <Alert tone="error">{error}</Alert>
      </ShopShell>
    );
  }

  const inStock = product.available > 0;

  return (
    <ShopShell
      crumbs={[
        { href: "/loja", label: "Loja" },
        { label: product.name },
      ]}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? (
        <Alert tone="success">
          {info}{" "}
          <Link href="/cart" className="font-medium underline">
            Ver carrinho
          </Link>
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <MediaFrame
          src={catalogImageUrl(product.image_url)}
          alt={product.name}
          ratio="4/3"
          className="ring-1 ring-neutral-200"
        />
        <div className="flex flex-col">
          {product.category_name ? (
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">{product.category_name}</p>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-2 font-mono text-xs text-neutral-500">SKU {product.sku_code}</p>
          {product.description ? <p className="mt-5 text-sm leading-relaxed text-neutral-600">{product.description}</p> : null}

          <div className="mt-8 border-t border-neutral-200 pt-6">
            <p className="text-3xl font-semibold">{formatUsd(product.price_usd)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              Com IVA {formatUsd(product.price_with_iva_usd)}
              {product.price_pyg ? ` · ref. ${formatPyg(product.price_pyg)}` : ""}
            </p>
            <p className={`mt-3 text-sm ${inStock ? "text-emerald-700" : "text-neutral-500"}`}>
              {inStock ? `${product.available} unidade(s) pronta(s) para envio` : "Sem estoque no momento — solicite cotação"}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button disabled={!inStock} onClick={() => void add()}>
              {inStock ? "Adicionar ao carrinho" : "Indisponível"}
            </Button>
            <Link
              href="/contato"
              className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Pedir cotação deste item
            </Link>
          </div>
        </div>
      </div>
    </ShopShell>
  );
}
