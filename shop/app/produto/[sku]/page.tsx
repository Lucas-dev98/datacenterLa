"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { addToCart, fetchProduct } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import type { CatalogProduct } from "@/lib/types";
import { Alert, Button, Card } from "@/components/ui";

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
      setInfo("Adicionado ao carrinho");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (!product) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← Catálogo</Link>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}
      <Card>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-sm text-slate-400">Sem imagem</span>
            )}
          </div>
          <div className="space-y-3">
            {product.category_name ? <p className="text-xs uppercase text-slate-400">{product.category_name}</p> : null}
            <p className="font-mono text-xs text-slate-500">{product.sku_code}</p>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {product.description ? <p className="text-slate-600">{product.description}</p> : null}
            <p className="text-2xl font-semibold">${product.price_usd.toFixed(2)}</p>
            {product.price_pyg ? (
              <p className="text-sm text-slate-600">
                Ref. {new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(product.price_pyg)}
                {product.price_with_iva_pyg ? (
                  <> · c/ IVA {new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(product.price_with_iva_pyg)}</>
                ) : null}
              </p>
            ) : null}
            <p className="text-sm text-slate-500">c/ IVA USD ${product.price_with_iva_usd.toFixed(2)} · {product.available} disponível(is)</p>
            <Button disabled={product.available < 1} onClick={() => void add()}>Adicionar ao carrinho</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
