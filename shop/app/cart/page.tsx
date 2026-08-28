"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCart, updateCartItem } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { getSessionId } from "@/lib/session";
import type { Cart } from "@/lib/types";
import { ShopShell } from "@/components/shop-shell";
import { Alert, Button } from "@/components/ui";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setCart(await fetchCart(getSessionId()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar carrinho");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const items = cart?.items ?? [];
  const total = items.reduce((sum, i) => sum + (i.price_usd ?? 0) * i.quantity, 0);

  async function changeQty(skuId: string, quantity: number) {
    if (quantity < 0) return;
    setError("");
    try {
      setCart(await updateCartItem(getSessionId(), skuId, quantity));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  return (
    <ShopShell crumbs={[{ label: "Carrinho" }]}>
      <h1 className="text-3xl font-semibold tracking-tight">Carrinho</h1>
      <p className="mt-1 text-sm text-neutral-500">Revisão dos itens antes do checkout.</p>

      {error ? <div className="mt-6"><Alert tone="error">{error}</Alert></div> : null}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-lg bg-white px-6 py-14 text-center ring-1 ring-neutral-200">
          <p className="text-neutral-800">Seu carrinho está vazio.</p>
          <Link href="/loja" className="mt-5 inline-flex rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white">
            Ir para a loja
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y divide-neutral-200 bg-white ring-1 ring-neutral-200">
            {items.map((item) => (
              <li key={item.sku_id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium">{item.name ?? item.sku_code}</p>
                  <p className="text-sm text-neutral-500">{formatUsd(item.price_usd ?? 0)} cada</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => void changeQty(item.sku_id, item.quantity - 1)}>
                    −
                  </Button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <Button variant="secondary" onClick={() => void changeQty(item.sku_id, item.quantity + 1)}>
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit bg-white p-6 ring-1 ring-neutral-200 lg:sticky lg:top-24">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">Resumo</p>
            <p className="mt-3 flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatUsd(total)}</span>
            </p>
            <p className="mt-6 text-2xl font-semibold">{formatUsd(total)}</p>
            <Link href="/checkout" className="mt-6 flex h-11 items-center justify-center rounded-lg bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800">
              Finalizar compra
            </Link>
            <Link href="/loja" className="mt-3 flex h-11 items-center justify-center text-sm text-neutral-600 hover:text-neutral-900">
              Continuar comprando
            </Link>
          </aside>
        </div>
      )}
    </ShopShell>
  );
}
