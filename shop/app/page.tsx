"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart, fetchCatalog, fetchCategories } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import type { CatalogProduct, EcommerceCategory } from "@/lib/types";
import { Alert, Button, Card, Input, Select } from "@/components/ui";

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<EcommerceCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    void fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        setProducts(await fetchCatalog(undefined, {
          categoryId: categoryId || undefined,
          q: search.trim() || undefined,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar catálogo");
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId, search]);

  async function handleAdd(skuId: string) {
    setInfo("");
    setAdding(skuId);
    try {
      await addToCart(getSessionId(), skuId, 1);
      setInfo("Produto adicionado ao carrinho");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Catálogo</h1>
        <p className="mt-1 text-sm text-slate-600">Preços em USD · referência em guaranis (PYG)</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar produtos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select className="max-w-xs" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todas categorias</option>
          {categories
            .filter((c) => !c.parent_id)
            .map((parent) => {
              const children = categories.filter((c) => c.parent_id === parent.id);
              if (children.length === 0) {
                return (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                );
              }
              return (
                <optgroup key={parent.id} label={parent.name}>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
        </Select>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando produtos…</p>
      ) : products.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Nenhum produto encontrado.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.sku_id}>
              <div className="space-y-3">
                <div>
                  {p.category_name ? (
                    <p className="text-xs uppercase text-slate-400">{p.category_name}</p>
                  ) : null}
                  <p className="font-mono text-xs text-slate-500">{p.sku_code}</p>
                  <h2 className="font-medium text-slate-900">
                    <Link href={`/produto/${p.sku_id}`} className="hover:text-blue-600">{p.name}</Link>
                  </h2>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>
                  ) : null}
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">${p.price_usd.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">
                      c/ IVA ${p.price_with_iva_usd.toFixed(2)}
                      {p.price_pyg ? (
                        <> · ref. {new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(p.price_pyg)}</>
                      ) : null}
                      {" · "}{p.available} disp.
                    </p>
                  </div>
                  <Button
                    disabled={p.available < 1 || adding === p.sku_id}
                    onClick={() => void handleAdd(p.sku_id)}
                  >
                    {adding === p.sku_id ? "…" : "Adicionar"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
