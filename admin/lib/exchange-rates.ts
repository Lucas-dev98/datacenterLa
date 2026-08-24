export type ExchangeRateQuote = {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  label: string;
  symbol: string;
};

export type ExchangeRatesToday = {
  base_currency: string;
  as_of: string;
  rates: ExchangeRateQuote[];
  source?: string;
  fetched_at?: string;
  provider_updated_at?: string;
};

export function formatExchangeRate(rate: number, currency: string): string {
  if (currency === "PYG") {
    return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(rate);
  }
  if (currency === "ARS") {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(rate);
  }
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(rate);
}

export function convertFromUSD(amountUsd: number, toCurrency: string, rates: ExchangeRateQuote[]): number | null {
  if (toCurrency === "USD") return amountUsd;
  const q = rates.find((r) => r.to_currency === toCurrency);
  if (!q || q.rate <= 0) return null;
  return amountUsd * q.rate;
}
