/** IVA paraguaio aplicado a vendas B2C para clientes paraguaios (10%). */
export const PARAGUAY_IVA_RATE = 0.1;

export const PARAGUAY_IVA_LABEL = "10%";

export function paraguayIVAFromNet(netUsd: number): number {
  return Math.round(netUsd * PARAGUAY_IVA_RATE * 100) / 100;
}

export function paraguayNetFromGross(grossUsd: number): number {
  return Math.round((grossUsd / (1 + PARAGUAY_IVA_RATE)) * 100) / 100;
}
