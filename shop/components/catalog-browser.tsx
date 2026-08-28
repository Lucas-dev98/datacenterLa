"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addToCart, fetchCatalog, fetchCategories } from "@/lib/api";
import { CATALOG_GROUPS, categoryIdsForGroup, productInGroup } from "@/lib/catalog-groups";
import { formatPyg, formatUsd } from "@/lib/format";
import { productDisplayImage } from "@/lib/product-image";
import { getSessionId } from "@/lib/session";
import type { CatalogProduct, EcommerceCategory } from "@/lib/types";
import { Breadcrumb } from "@/components/breadcrumb";
import { MediaFrame } from "@/components/media-frame";
import { Alert, Button, Input, Select } from "@/components/ui";

export function CatalogBrowser() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const grupo = searchParams.get("grupo") ?? "";

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<EcommerceCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState(initialQ);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    setCategoryId("");
  }, [grupo]);

  useEffect(() => {
    setSearch(initialQ);
  }, [initialQ]);

  useEffect(() => {
    void fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          setProducts(
            await fetchCatalog(undefined, {
              categoryId: categoryId || undefined,
              q: search.trim() || undefined,
            }),
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erro ao carregar catálogo");
        } finally {
          setLoading(false);
        }
      })();
    }, search === initialQ ? 0 : 250);
    return () => clearTimeout(t);
  }, [categoryId, search, initialQ]);

  const visible = useMemo(() => {
    if (!grupo) return products;
    return products.filter((p) => productInGroup(p, categories, grupo));
  }, [products, categories, grupo]);

  const groupLabel = CATALOG_GROUPS[grupo as keyof typeof CATALOG_GROUPS]?.label;
  const waitingGroup = Boolean(grupo && categories.length === 0);

  async function handleAdd(skuId: string) {
    setInfo("");
    setAdding(skuId);
    try {
      await addToCart(getSessionId(), skuId, 1);
      setInfo("Adicionado ao carrinho.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div>
      <Breadcrumb items={groupLabel ? [{ href: "/loja", label: "Loja" }, { label: groupLabel }] : [{ label: "Loja" }]} />

      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{groupLabel ?? "Loja"}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Preços em USD · referência em guaranis · {loading || waitingGroup ? "…" : `${visible.length} itens`}
          </p>
        </div>
        <Link href="/contato" className="text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">
          Precisa de um modelo específico? Cotação →
        </Link>
      </header>

      <div className="sticky top-16 z-20 -mx-4 mt-6 border-y border-neutral-200 bg-[#f4f3ef]/95 px-4 py-3 backdrop-blur md:-mx-0 md:px-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/loja"
              className={`rounded-full px-3 py-1.5 text-[13px] ${!grupo ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-neutral-400"}`}
            >
              Todos
            </Link>
            {Object.entries(CATALOG_GROUPS).map(([key, item]) => (
              <Link
                key={key}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-[13px] ${grupo === key ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-neutral-400"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
            <Input
              id="busca"
              className="max-w-xs bg-white"
              placeholder="SKU, nome, marca…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select className="max-w-xs bg-white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Linha completa</option>
              {categories
                .filter((c) => {
                  if (c.parent_id) return false;
                  const ids = grupo ? categoryIdsForGroup(categories, grupo) : null;
                  return !ids || ids.has(c.id);
                })
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
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {info ? <Alert tone="success">{info}</Alert> : null}
      </div>

      {loading || waitingGroup ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-lg bg-white/70 ring-1 ring-neutral-200" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-lg bg-white px-6 py-14 text-center ring-1 ring-neutral-200">
          <p className="text-neutral-800">Nenhum produto nesta combinação.</p>
          <p className="mt-1 text-sm text-neutral-500">Ajuste a busca ou peça sourcing — localizamos o modelo.</p>
          <Link href="/contato" className="mt-5 inline-flex rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white">
            Solicitar cotação
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <article key={p.sku_id} className="group flex flex-col bg-white ring-1 ring-neutral-200 transition hover:ring-neutral-400">
              <Link href={`/produto/${p.sku_id}`} className="block">
                <MediaFrame
                  src={productDisplayImage(p.category_name, p.name, p.image_url)}
                  alt=""
                  ratio="4/3"
                />
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">
                    {p.category_name ?? "Hardware"} · {p.sku_code}
                  </p>
                  <h2 className="mt-1 text-[15px] font-medium leading-snug">
                    <Link href={`/produto/${p.sku_id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </h2>
                </div>
                <div className="mt-auto flex items-end justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{formatUsd(p.price_usd)}</p>
                    <p className="text-[12px] text-neutral-500">
                      {p.available > 0 ? `${p.available} em estoque` : "Sob consulta"}
                      {p.price_pyg ? ` · ${formatPyg(p.price_pyg)}` : null}
                    </p>
                  </div>
                  <Button
                    className="shrink-0"
                    disabled={p.available < 1 || adding === p.sku_id}
                    onClick={() => void handleAdd(p.sku_id)}
                  >
                    {adding === p.sku_id ? "…" : p.available < 1 ? "Indisponível" : "Adicionar"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
