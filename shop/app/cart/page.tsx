"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCart, updateCartItem } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import type { Cart } from "@/lib/types";
import { Alert, Button, Card } from "@/components/ui";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Carrinho</h1>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Seu carrinho está vazio.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Ver catálogo
          </Link>
        </Card>
      ) : (
        <>
          <Card title="Itens">
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.sku_id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{item.name ?? item.sku_code}</p>
                    <p className="text-sm text-slate-500">
                      ${(item.price_usd ?? 0).toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => void changeQty(item.sku_id, item.quantity - 1)}>
                      −
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button variant="secondary" onClick={() => void changeQty(item.sku_id, item.quantity + 1)}>
                      +
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-right text-lg font-semibold text-slate-900">
              Total: ${total.toFixed(2)}
            </p>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/">
              <Button variant="secondary" type="button">
                Continuar comprando
              </Button>
            </Link>
            <Link href="/checkout">
              <Button>Finalizar compra</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
