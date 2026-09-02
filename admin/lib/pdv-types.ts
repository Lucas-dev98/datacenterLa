export type CartLine = {
  sku_id: string;
  code: string;
  name: string;
  base_price_usd: number;
  price_with_iva_usd: number;
  price_pyg?: number;
  price_with_iva_pyg?: number;
  qty_available: number;
  quantity: number;
};

export function lineUnitUsd(line: CartLine, withIVA: boolean): number {
  return withIVA ? line.price_with_iva_usd : line.base_price_usd;
}
