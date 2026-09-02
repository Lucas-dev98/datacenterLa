"use client";

import { FormEvent, RefObject } from "react";
import type { SKU } from "@/lib/types";
import type { CartLine } from "@/lib/pdv-types";
import { lineUnitUsd } from "@/lib/pdv-types";
import { Card, Input } from "@/components/ui";

type Props = {
  searchRef: RefObject<HTMLInputElement | null>;
  autoFocusSearch: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
  searching: boolean;
  searchResults: SKU[];
  onAddSku: (sku: SKU) => void;
  cart: CartLine[];
  chargesIVA: boolean;
  onUpdateQty: (skuId: string, quantity: number) => void;
  onRemoveLine: (skuId: string) => void;
};

export function PDVProductsPanel({
  searchRef,
  autoFocusSearch,
  query,
  onQueryChange,
  onSearchSubmit,
  searching,
  searchResults,
  onAddSku,
  cart,
  chargesIVA,
  onUpdateQty,
  onRemoveLine,
}: Props) {
  return (
    <div className="space-y-4">
      <Card title="2. Produtos">
        <form onSubmit={onSearchSubmit}>
          <Input
            inputRef={searchRef}
            autoFocus={autoFocusSearch}
            placeholder="SKU, nome, marca, categoria ou código da peça…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </form>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {searching ? (
            <p className="text-sm text-slate-500">Buscando…</p>
          ) : query && searchResults.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum SKU encontrado.</p>
          ) : (
            searchResults.map((sku) => (
              <button
                key={sku.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                onClick={() => onAddSku(sku)}
              >
                <span>
                  <span className="font-mono font-medium">{sku.code}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  {sku.name}
                </span>
                <span className="text-blue-600">+ Adicionar</span>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card title={`Carrinho (${cart.length})`}>
        {cart.length === 0 ? (
          <p className="text-sm text-slate-500">Escaneie ou busque produtos para iniciar.</p>
        ) : (
          <div className="space-y-3">
            {cart.map((line) => (
              <div
                key={line.sku_id}
                className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">{line.code}</p>
                  <p className="truncate text-sm text-slate-600">{line.name}</p>
                  <p className="text-xs text-slate-500">
                    USD {lineUnitUsd(line, chargesIVA).toFixed(2)}
                    {chargesIVA ? " c/ IVA" : ""}
                    {(chargesIVA ? line.price_with_iva_pyg : line.price_pyg)
                      ? ` · ₲ ${Math.round(chargesIVA ? line.price_with_iva_pyg! : line.price_pyg!).toLocaleString("es-PY")}`
                      : ""}
                    {" · "}disp. {line.qty_available}
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={line.qty_available}
                  className="w-20"
                  value={line.quantity}
                  onChange={(e) => onUpdateQty(line.sku_id, parseInt(e.target.value, 10) || 1)}
                />
                <p className="w-24 text-right font-medium">
                  ${(lineUnitUsd(line, chargesIVA) * line.quantity).toFixed(2)}
                </p>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => onRemoveLine(line.sku_id)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
