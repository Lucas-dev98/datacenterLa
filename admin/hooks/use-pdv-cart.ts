"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { pricingApi } from "@/lib/api/pricing";
import { stockApi } from "@/lib/api/stock";
import type { SKU } from "@/lib/types";
import { searchPdvSkus } from "@/lib/pdv-product-search";
import type { CartLine } from "@/lib/pdv-types";

type Options = {
  onError: (message: string) => void;
  clearError?: () => void;
};

export function usePdvCart({ onError, clearError }: Options) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SKU[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);

  const loadProductMeta = useCallback(
    async (sku: SKU): Promise<CartLine | null> => {
      try {
        const [price, avail] = await Promise.all([
          pricingApi.resolveB2C(sku.id),
          stockApi.availability(sku.id),
        ]);
        const qty = avail.qty_available ?? 0;
        if (qty <= 0) {
          onError(`Sem estoque para ${sku.code}`);
          return null;
        }
        return {
          sku_id: sku.id,
          code: sku.code,
          name: sku.name,
          base_price_usd: price.base_price_usd,
          price_with_iva_usd: price.price_with_iva_usd ?? price.base_price_usd,
          price_pyg: price.price_pyg,
          price_with_iva_pyg: price.price_with_iva_pyg,
          qty_available: qty,
          quantity: 1,
        };
      } catch (err) {
        onError(err instanceof Error ? err.message : "Erro ao carregar produto");
        return null;
      }
    },
    [onError],
  );

  const addToCart = useCallback(
    async (sku: SKU) => {
      clearError?.();
      const existing = cart.find((l) => l.sku_id === sku.id);
      if (existing) {
        if (existing.quantity >= existing.qty_available) {
          onError(`Estoque insuficiente para ${sku.code}`);
          return;
        }
        setCart((prev) =>
          prev.map((l) => (l.sku_id === sku.id ? { ...l, quantity: l.quantity + 1 } : l)),
        );
        return;
      }
      const line = await loadProductMeta(sku);
      if (line) {
        setCart((prev) => [...prev, line]);
        setQuery("");
        setSearchResults([]);
        searchRef.current?.focus();
      }
    },
    [cart, clearError, loadProductMeta, onError],
  );

  const searchProducts = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      clearError?.();
      try {
        setSearchResults(await searchPdvSkus(term));
      } catch (err) {
        onError(err instanceof Error ? err.message : "Erro na busca");
      } finally {
        setSearching(false);
      }
    },
    [clearError, onError],
  );

  useEffect(() => {
    const t = setTimeout(() => void searchProducts(query), 250);
    return () => clearTimeout(t);
  }, [query, searchProducts]);

  function updateQty(skuId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.sku_id !== skuId) return l;
          const q = Math.max(1, Math.min(quantity, l.qty_available));
          return { ...l, quantity: q };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(skuId: string) {
    setCart((prev) => prev.filter((l) => l.sku_id !== skuId));
  }

  function clearCart() {
    setCart([]);
    setQuery("");
    setSearchResults([]);
  }

  async function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchResults.length >= 1) {
      await addToCart(searchResults[0]);
    }
  }

  return {
    searchRef,
    query,
    setQuery,
    searchResults,
    searching,
    cart,
    addToCart,
    updateQty,
    removeLine,
    clearCart,
    onSearchSubmit,
    focusSearch: () => searchRef.current?.focus(),
  };
}
