"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { fetchCatalog } from "@/lib/api";
import { productDisplayImage } from "@/lib/product-image";
import type { CatalogProduct } from "@/lib/types";

export function ShopSearch({
  variant = "header",
  initialQ = "",
  onNavigate,
}: {
  variant?: "header" | "mobile";
  initialQ?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(initialQ);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      void fetchCatalog(undefined, { q: term })
        .then((items) => {
          setHits(items.slice(0, 7));
          setActive(0);
          setOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goCatalog(term: string) {
    onNavigate?.();
    setOpen(false);
    router.push(term ? `/loja?q=${encodeURIComponent(term)}` : "/loja");
  }

  function goSearch(e: FormEvent) {
    e.preventDefault();
    goCatalog(q.trim());
  }

  const term = q.trim();
  const show = open && term.length >= 2 && (hits.length > 0 || (!loading && term.length >= 2));
  const inputClass =
    variant === "mobile"
      ? "h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40"
      : "h-10 w-52 rounded-full border border-white/15 bg-white/5 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-white/40 focus:bg-white/10 xl:w-72";

  return (
    <div ref={rootRef} className={variant === "header" ? "relative hidden md:block" : "relative"}>
      <form onSubmit={goSearch} className={variant === "header" ? "relative" : ""}>
        {variant === "header" ? (
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
        ) : null}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => term.length >= 2 && setOpen(true)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              onNavigate?.();
              setOpen(false);
              router.push(`/produto/${hits[active].sku_id}`);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Buscar SKU, modelo…"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={show}
          className={inputClass}
        />
      </form>
      {show ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[70] mt-2 max-h-80 w-[min(100vw-2rem,22rem)] overflow-auto rounded-lg border border-white/15 bg-zinc-950 py-1 shadow-xl"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-white/50">Nenhum produto com “{term}”.</li>
          ) : (
            hits.map((p, i) => (
              <li key={p.sku_id} role="option" aria-selected={i === active}>
                <Link
                  href={`/produto/${p.sku_id}`}
                  onClick={() => onNavigate?.()}
                  className={`flex items-center gap-3 px-3 py-2 text-left text-[13px] ${
                    i === active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productDisplayImage(p.category_name, p.name, p.image_url)}
                    alt=""
                    className="h-10 w-14 shrink-0 object-contain"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block font-mono text-[11px] text-white/40">
                      {p.sku_code}
                      {p.category_name ? ` · ${p.category_name}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))
          )}
          <li>
            <Link
              href={`/loja?q=${encodeURIComponent(term)}`}
              onClick={() => onNavigate?.()}
              className="block px-3 py-2 text-[12px] text-white/50 hover:text-white"
            >
              {hits.length === 0 ? "Buscar no catálogo →" : "Ver todos os resultados →"}
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
