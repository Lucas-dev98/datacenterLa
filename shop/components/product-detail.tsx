"use client";

import { useState } from "react";
import Link from "next/link";
import { addToCart } from "@/lib/api";
import { formatPyg, formatUsd } from "@/lib/format";
import { catalogImageUrl } from "@/lib/product-image";
import { getSessionId } from "@/lib/session";
import type { CatalogProduct } from "@/lib/types";
import { ShopShell } from "@/components/shop-shell";
import { MediaFrame } from "@/components/media-frame";
import { Alert, Button } from "@/components/ui";

type ProductDetailProps = {
  product: CatalogProduct;
};

export function ProductDetail({ product }: ProductDetailProps) {
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    setAdding(true);
    setError("");
    try {
      await addToCart(getSessionId(), product.sku_id, 1);
      setInfo("Adicionado ao carrinho.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setAdding(false);
    }
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

      <div className="mt-4 grid gap-8 pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pb-0">
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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-2 font-mono text-xs text-neutral-500">SKU {product.sku_code}</p>
          {product.description ? (
            <p className="mt-5 text-sm leading-relaxed text-neutral-600">{product.description}</p>
          ) : null}

          <div className="mt-8 border-t border-neutral-200 pt-6">
            <p className="text-2xl font-semibold sm:text-3xl">{formatUsd(product.price_usd)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              Com IVA {formatUsd(product.price_with_iva_usd)}
              {product.price_pyg ? ` · ref. ${formatPyg(product.price_pyg)}` : ""}
            </p>
            <p className={`mt-3 text-sm ${inStock ? "text-emerald-700" : "text-neutral-500"}`}>
              {inStock
                ? `${product.available} unidade(s) pronta(s) para envio`
                : "Sem estoque no momento — solicite cotação"}
            </p>
          </div>

          <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
            <Button className="min-h-11" disabled={!inStock || adding} onClick={() => void add()}>
              {adding ? "Adicionando…" : inStock ? "Adicionar ao carrinho" : "Indisponível"}
            </Button>
            <Link
              href="/contato"
              className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium hover:bg-neutral-50"
            >
              Pedir cotação deste item
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 pt-3 backdrop-blur lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{formatUsd(product.price_usd)}</p>
            <p className="truncate text-[11px] text-neutral-500">{product.name}</p>
          </div>
          {inStock ? (
            <Button className="min-h-11 shrink-0" disabled={adding} onClick={() => void add()}>
              {adding ? "…" : "Adicionar"}
            </Button>
          ) : (
            <Link
              href="/contato"
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white"
            >
              Cotação
            </Link>
          )}
        </div>
      </div>
    </ShopShell>
  );
}
