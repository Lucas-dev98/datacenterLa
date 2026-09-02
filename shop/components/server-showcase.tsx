"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/types";
import { catalogImageUrl } from "@/lib/product-image";
import {
  FALLBACK_SHOWCASE_SLIDES,
  productBrandLine,
  shortProductLabel,
} from "@/lib/storefront-defaults";

type Slide = {
  key: string;
  image: string;
  brand: string;
  model: string;
  href: string;
  shortLabel: string;
};

type ServerShowcaseProps = {
  products: CatalogProduct[];
};

function slidesFromProducts(products: CatalogProduct[]): Slide[] {
  const picked = products.slice(0, 6);
  if (picked.length === 0) {
    return FALLBACK_SHOWCASE_SLIDES.map((s, i) => ({ ...s, key: `fallback-${i}` }));
  }
  return picked.map((p) => ({
    key: p.sku_id,
    image: catalogImageUrl(p.image_url),
    brand: productBrandLine(p.name),
    model: shortProductLabel(p.name),
    href: `/produto/${p.sku_id}`,
    shortLabel: shortProductLabel(p.name),
  }));
}

export function ServerShowcase({ products }: ServerShowcaseProps) {
  const slides = useMemo(() => slidesFromProducts(products), [products]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  function prev() {
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  }
  function next() {
    setIndex((i) => (i + 1) % slides.length);
  }

  return (
    <section className="border-t border-white/10 px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden border border-white/10 bg-black">
          <div className="grid min-h-[min(72vh,640px)] items-center md:grid-cols-[1fr_auto]">
            <Link href={slide.href} className="flex h-full items-center justify-center px-6 py-10 md:px-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt=""
                className="max-h-[min(58vh,520px)] w-auto max-w-full object-contain"
              />
            </Link>
            <div className="border-t border-white/10 px-8 py-10 text-center md:border-l md:border-t-0 md:py-0 md:pr-12 md:text-left">
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">{slide.brand}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{slide.model}</p>
              <div className="mt-8 flex items-center justify-center gap-3 md:justify-start">
                <button
                  type="button"
                  onClick={prev}
                  className="flex h-11 w-11 items-center justify-center border border-white/25 text-white/80 hover:border-white hover:text-white"
                  aria-label="Anterior"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="flex h-11 w-11 items-center justify-center border border-white/25 text-white/80 hover:border-white hover:text-white"
                  aria-label="Próximo"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap justify-center gap-2 md:gap-3" aria-label="Modelos em destaque">
          {slides.map((item, i) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setIndex(i)}
              className={`border px-4 py-2 text-sm transition ${
                i === index
                  ? "border-white bg-white text-black"
                  : "border-white/20 text-white/75 hover:border-white/50 hover:text-white"
              }`}
            >
              {item.shortLabel}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
