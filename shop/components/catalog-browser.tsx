"use client";

import Link from "next/link";
import {
  FormEvent,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { addToCart, fetchCatalog, fetchCategories } from "@/lib/api";
import { seedCatalogCache } from "@/lib/catalog-cache";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import { CATALOG_GROUPS, categoryIdsForGroup, productInGroup } from "@/lib/catalog-groups";
import { formatPyg, formatUsd } from "@/lib/format";
import { catalogImageUrl } from "@/lib/product-image";
import { getSessionId } from "@/lib/session";
import type { CatalogProduct, EcommerceCategory } from "@/lib/types";
import { Breadcrumb } from "@/components/breadcrumb";
import { MediaFrame } from "@/components/media-frame";
import { Alert, Button, Input, Select } from "@/components/ui";

const PAGE_SIZE = 24;

function matchesSearch(product: CatalogProduct, query: string): boolean {
  const t = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(t) ||
    product.sku_code.toLowerCase().includes(t) ||
    (product.description?.toLowerCase().includes(t) ?? false) ||
    (product.category_name?.toLowerCase().includes(t) ?? false)
  );
}

const ProductCard = memo(function ProductCard({
  product,
  adding,
  onAdd,
}: {
  product: CatalogProduct;
  adding: boolean;
  onAdd: (skuId: string) => void;
}) {
  return (
    <article className="group flex flex-col bg-white ring-1 ring-neutral-200 transition hover:ring-neutral-400">
      <Link href={`/produto/${product.sku_id}`} className="block">
        <MediaFrame src={catalogImageUrl(product.image_url)} alt="" ratio="4/3" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            {product.category_name ?? "Hardware"} · {product.sku_code}
          </p>
          <h2 className="mt-1 text-[15px] font-medium leading-snug">
            <Link href={`/produto/${product.sku_id}`} className="hover:underline">
              {product.name}
            </Link>
          </h2>
        </div>
        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold">{formatUsd(product.price_usd)}</p>
            <p className="text-[12px] text-neutral-500">
              {product.available > 0 ? `${product.available} em estoque` : "Sob consulta"}
              {product.price_pyg ? ` · ${formatPyg(product.price_pyg)}` : null}
            </p>
          </div>
          <Button
            className="w-full min-h-11 shrink-0 sm:w-auto"
            disabled={product.available < 1 || adding}
            onClick={() => onAdd(product.sku_id)}
          >
            {adding ? "…" : product.available < 1 ? "Indisponível" : "Adicionar"}
          </Button>
        </div>
      </div>
    </article>
  );
});

export function CatalogBrowser({
  q: urlQ = "",
  grupo = "",
  initialProducts,
  initialCategories,
}: {
  q?: string;
  grupo?: string;
  initialProducts?: CatalogProduct[];
  initialCategories?: EcommerceCategory[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasInitial = Boolean(initialProducts && initialProducts.length > 0);

  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts ?? []);
  const [categories, setCategories] = useState<EcommerceCategory[]>(initialCategories ?? []);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState(urlQ);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  const deferredSearch = useDeferredValue(search);
  const deferredCategoryId = useDeferredValue(categoryId);
  const term = deferredSearch.trim();
  const searching = term.length > 0;
  const filtering = deferredSearch !== search || deferredCategoryId !== categoryId;

  useEffect(() => {
    setCategoryId("");
  }, [grupo]);

  useEffect(() => {
    setSearch(urlQ);
  }, [urlQ]);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [term, grupo, deferredCategoryId]);

  useEffect(() => {
    if (!initialProducts?.length) return;
    seedCatalogCache(DEFAULT_WAREHOUSE_ID, initialProducts, initialCategories);
  }, [initialProducts, initialCategories]);

  useEffect(() => {
    if (initialProducts?.length) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.all([fetchCatalog(), fetchCategories()])
      .then(([items, cats]) => {
        if (cancelled) return;
        setProducts(items);
        setCategories(cats);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar catálogo");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialProducts]);

  useEffect(() => {
    if (search.trim() === urlQ) return;
    const t = setTimeout(() => {
      const q = search.trim();
      const next = q
        ? `/loja?q=${encodeURIComponent(q)}`
        : grupo
          ? `/loja?grupo=${encodeURIComponent(grupo)}`
          : "/loja";
      router.replace(next, { scroll: false });
    }, 600);
    return () => clearTimeout(t);
  }, [search, urlQ, grupo, router]);

  const categoryOptions = useMemo(() => {
    return categories
      .filter((c) => {
        if (c.parent_id) return false;
        const ids = grupo ? categoryIdsForGroup(categories, grupo) : null;
        return !ids || ids.has(c.id);
      })
      .flatMap((parent) => {
        const children = categories.filter((c) => c.parent_id === parent.id);
        if (children.length === 0) {
          return [{ key: parent.id, value: parent.id, label: parent.name, group: null as string | null }];
        }
        return children.map((c) => ({
          key: c.id,
          value: c.id,
          label: c.name,
          group: parent.name,
        }));
      });
  }, [categories, grupo]);

  const visible = useMemo(() => {
    let list = products;
    if (searching) {
      list = list.filter((p) => matchesSearch(p, term));
    } else if (grupo) {
      list = list.filter((p) => productInGroup(p, categories, grupo));
    }
    if (deferredCategoryId) {
      list = list.filter((p) => p.category_id === deferredCategoryId);
    }
    return list;
  }, [products, categories, grupo, searching, term, deferredCategoryId]);

  const displayed = useMemo(() => visible.slice(0, shown), [visible, shown]);
  const hasMore = shown < visible.length;

  const groupLabel = CATALOG_GROUPS[grupo as keyof typeof CATALOG_GROUPS]?.label;

  const handleAdd = useCallback(async (skuId: string) => {
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
  }, []);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    const next = q ? `/loja?q=${encodeURIComponent(q)}` : grupo ? `/loja?grupo=${encodeURIComponent(grupo)}` : "/loja";
    router.push(next);
  }

  return (
    <div>
      <Breadcrumb
        items={
          searching
            ? [{ href: "/loja", label: "Loja" }, { label: `Busca` }]
            : groupLabel
              ? [{ href: "/loja", label: "Loja" }, { label: groupLabel }]
              : [{ label: "Loja" }]
        }
      />

      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {searching ? `Resultados para “${term}”` : (groupLabel ?? "Loja")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Preços em USD · referência em guaranis ·{" "}
            {loading ? "…" : `${visible.length} itens${filtering ? " (filtrando…)" : ""}`}
          </p>
        </div>
        <Link href="/contato" className="shrink-0 text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">
          Precisa de um modelo específico? Cotação →
        </Link>
      </header>

      <div
        className="sticky z-20 -mx-4 mt-6 border-y border-neutral-200 bg-[#f4f3ef]/95 px-4 py-3 backdrop-blur md:-mx-0 md:px-0"
        style={{ top: "var(--shop-header-h)" }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <Link
              href="/loja"
              className={`shrink-0 rounded-full px-3.5 py-2.5 text-[13px] ${!grupo || searching ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-neutral-400"}`}
            >
              Todos
            </Link>
            {Object.entries(CATALOG_GROUPS).map(([key, item]) => (
              <Link
                key={key}
                href={item.href}
                className={`shrink-0 rounded-full px-3.5 py-2.5 text-[13px] ${!searching && grupo === key ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:ring-neutral-400"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
            <form onSubmit={submitSearch} className="relative w-full max-w-none flex-1 sm:max-w-xs">
              <Input
                id="busca"
                className="min-h-11 bg-white pr-9 text-base sm:text-sm"
                placeholder="SKU, marca, modelo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 hover:text-neutral-700"
                >
                  ×
                </button>
              ) : null}
            </form>
            <Select
              className="min-h-11 w-full max-w-none bg-white text-base sm:max-w-xs sm:text-sm"
              value={categoryId}
              onChange={(e) => startTransition(() => setCategoryId(e.target.value))}
            >
              <option value="">Linha completa</option>
              {categoryOptions.map((opt) =>
                opt.group ? (
                  <option key={opt.key} value={opt.value}>
                    {opt.group} — {opt.label}
                  </option>
                ) : (
                  <option key={opt.key} value={opt.value}>
                    {opt.label}
                  </option>
                ),
              )}
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {info ? <Alert tone="success">{info}</Alert> : null}
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-lg bg-white/70 ring-1 ring-neutral-200" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-lg bg-white px-6 py-14 text-center ring-1 ring-neutral-200">
          <p className="text-neutral-800">
            {searching ? `Nenhum produto para “${term}”.` : "Nenhum produto nesta combinação."}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {searching
              ? "Tente SKU, marca ou um termo mais curto — ou peça sourcing."
              : "Ajuste a busca ou peça sourcing — localizamos o modelo."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {searching ? (
              <Link href="/loja" className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm text-neutral-800 ring-1 ring-neutral-300">
                Limpar busca
              </Link>
            ) : null}
            <Link href="/contato" className="inline-flex rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white">
              Solicitar cotação
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${filtering ? "opacity-70" : ""}`}
          >
            {displayed.map((p) => (
              <ProductCard
                key={p.sku_id}
                product={p}
                adding={adding === p.sku_id}
                onAdd={(id) => void handleAdd(id)}
              />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-8 flex justify-center">
              <Button
                variant="secondary"
                className="min-h-11 px-8"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
              >
                Carregar mais ({visible.length - shown} restantes)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
