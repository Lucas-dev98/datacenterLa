"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Product, SKU } from "@/lib/types";
import { Alert, Card, Input, Table } from "@/components/ui";

function usd(n?: number | null): string {
  return n != null && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

export default function ProdutosPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const q = query ? `&q=${encodeURIComponent(query)}` : "";
      try {
        const [p, s] = await Promise.all([
          api<{ items: Product[]; total: number }>(`/api/v1/pim/products?active_only=true&limit=50${q}`),
          api<{ items: SKU[]; total: number }>(`/api/v1/pim/skus?active_only=true&limit=100${q}`),
        ]);
        setProducts(p.items);
        setSkus(s.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [query]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Produtos / SKUs</h1>
          <p className="mt-1 text-sm text-slate-600">Cadastros comerciais, preços USD e traduções ES.</p>
        </div>
        <Link href="/cadastros" className="text-sm font-medium text-blue-600 hover:underline">
          + Novo cadastro
        </Link>
      </header>

      <Card title="SKUs comerciais">
        <div className="mb-4">
          <Input
            placeholder="Buscar SKU, código ou produto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : (
          <Table
            headers={["Código", "Nome", "Custo", "B2C", "B2B", "Revenda", "CP", "E-commerce", "ES", ""]}
            rows={skus.map((s) => {
              const product = products.find((p) => p.id === s.product_id);
              const hasEs = product?.description_es || product?.name_es || product?.generated_description_es;
              return [
                <span key="c" className="font-mono font-medium">{s.code}</span>,
                s.name,
                <span key="cost" className="font-mono tabular-nums">{usd(s.cost_usd)}</span>,
                <span key="b2c" className="font-mono tabular-nums">{usd(s.price_b2c_usd)}</span>,
                <span key="b2b" className="font-mono tabular-nums">{usd(s.price_b2b_usd)}</span>,
                <span key="res" className="font-mono tabular-nums">{usd(s.price_reseller_usd)}</span>,
                s.publish_compras_paraguai ? "Sim" : "Não",
                s.publish_ecommerce ? "Sim" : "Não",
                hasEs ? "✓" : "—",
                product ? (
                  <Link key="e" href={`/produtos/${product.id}`} className="text-blue-600 hover:underline">
                    Editar
                  </Link>
                ) : (
                  "—"
                ),
              ];
            })}
          />
        )}
      </Card>

      <Card title="Produtos">
        <Table
          headers={["Nome", "Marca", "name_es", "description_es", ""]}
          rows={products.map((p) => [
            p.name,
            p.brand ?? "—",
            p.name_es ?? "—",
            p.description_es ? `${p.description_es.slice(0, 40)}…` : "—",
            <Link key="e" href={`/produtos/${p.id}`} className="text-blue-600 hover:underline">
              Editar
            </Link>,
          ])}
        />
      </Card>
    </div>
  );
}
