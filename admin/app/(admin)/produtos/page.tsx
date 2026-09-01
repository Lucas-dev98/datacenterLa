"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeleteSkuProduct } from "@/hooks/use-pim-product-mutations";
import { useProductCatalog } from "@/hooks/use-pim-list-queries";
import type { Product, SKU } from "@/lib/types";
import { Alert, Button, Card, Input, Table } from "@/components/ui";

function usd(n?: number | null): string {
  return n != null && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

export default function ProdutosPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data, error: loadError, loading, refetch } = useProductCatalog(query);
  const productsById = data?.productsById ?? {};
  const skus = data?.skus ?? [];
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run: deleteSkuProduct, loading: deleting } = useDeleteSkuProduct();

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  const allSelected = skus.length > 0 && selected.size === skus.length;
  const selectedSkus = useMemo(() => skus.filter((s) => selected.has(s.id)), [skus, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmDelete(false);
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(skus.map((s) => s.id)));
    setConfirmDelete(false);
  }

  async function deleteSelected() {
    if (selectedSkus.length === 0) return;
    setError("");
    setInfo("");
    const failed: string[] = [];
    let ok = 0;
    for (const sku of selectedSkus) {
      try {
        await deleteSkuProduct({ skuId: sku.id, productId: sku.product_id });
        ok += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "erro";
        failed.push(`${sku.code}: ${msg}`);
      }
    }
    setConfirmDelete(false);
    if (ok > 0) {
      setInfo(`${ok} produto(s) removido(s).`);
    }
    if (failed.length > 0) {
      setError(`Não foi possível apagar ${failed.length} produto(s): ${failed.join(" · ")}`);
    }
    await refetch();
    setSelected(new Set());
    setConfirmDelete(false);
  }

  function openProduct(sku: SKU) {
    if (!sku.product_id) return;
    router.push(`/produtos/${sku.product_id}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Produtos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada cadastro é um produto com um código SKU, preços USD e tradução ES.
          </p>
        </div>
        <Link href="/cadastros" className="text-sm font-medium text-blue-600 hover:underline">
          + Novo cadastro
        </Link>
      </header>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder="Buscar por código, nome ou marca…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {selected.size > 0 ? (
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
            >
              Apagar selecionados ({selected.size})
            </Button>
          ) : null}
        </div>

        {confirmDelete && selected.size > 0 ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">
              Apagar <strong>{selected.size}</strong> produto(s)? O cadastro sai da lista ativa. Itens
              com estoque físico não podem ser removidos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="danger" disabled={deleting} onClick={() => void deleteSelected()}>
                {deleting ? "Apagando…" : "Confirmar exclusão"}
              </Button>
              <Button type="button" variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}
        {info ? <Alert tone="success">{info}</Alert> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : skus.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum produto encontrado.</p>
        ) : (
          <Table
            onRowClick={(index) => openProduct(skus[index])}
            headers={[
              <input
                key="all"
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                onClick={(e) => e.stopPropagation()}
                aria-label="Selecionar todos"
              />,
              "Código",
              "Nome",
              "Custo",
              "B2C",
              "B2B",
              "Revenda",
              "CP",
              "E-commerce",
              "ES",
              "",
            ]}
            rows={skus.map((s) => {
              const product = s.product_id ? productsById[s.product_id] : undefined;
              const hasEs = product?.description_es || product?.name_es || product?.generated_description_es;
              return [
                <input
                  key={`cb-${s.id}`}
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Selecionar ${s.code}`}
                />,
                <span key="c" className="font-mono font-medium text-blue-700">
                  {s.code}
                </span>,
                <span key="n" className="font-medium text-slate-900">
                  {s.name}
                </span>,
                <span key="cost" className="font-mono tabular-nums">
                  {usd(s.cost_usd)}
                </span>,
                <span key="b2c" className="font-mono tabular-nums">
                  {usd(s.price_b2c_usd)}
                </span>,
                <span key="b2b" className="font-mono tabular-nums">
                  {usd(s.price_b2b_usd)}
                </span>,
                <span key="res" className="font-mono tabular-nums">
                  {usd(s.price_reseller_usd)}
                </span>,
                s.publish_compras_paraguai ? "Sim" : "Não",
                s.publish_ecommerce ? "Sim" : "Não",
                hasEs ? "✓" : "—",
                <span key="a" className="flex flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
                  {product ? (
                    <Link href={`/produtos/${product.id}`} className="text-blue-600 hover:underline">
                      Editar
                    </Link>
                  ) : (
                    "—"
                  )}
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:text-slate-400"
                    disabled={deleting}
                    onClick={() => {
                      setSelected(new Set([s.id]));
                      setConfirmDelete(true);
                    }}
                  >
                    Apagar
                  </button>
                </span>,
              ];
            })}
          />
        )}
      </Card>
    </div>
  );
}
