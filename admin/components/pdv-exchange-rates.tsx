import type { ExchangeRatesToday } from "@/lib/exchange-rates";
import { formatExchangeRate } from "@/lib/exchange-rates";

type Props = {
  data: ExchangeRatesToday | null;
  loading?: boolean;
  totalUsd?: number;
};

export function PDVExchangeRatesPanel({ data, loading, totalUsd }: Props) {
  const asOf = data?.as_of
    ? new Date(data.as_of).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Cotações do dia</h2>
          <p className="text-xs text-slate-600">
            Atualização automática · base {data?.base_currency ?? "USD"}
            {asOf ? ` · ${asOf}` : ""}
            {data?.source === "market" && data.fetched_at
              ? ` · sync ${new Date(data.fetched_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
        {loading ? <span className="text-xs text-slate-500">Atualizando…</span> : null}
      </div>

      {data?.rates?.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.rates.map((q) => (
            <div
              key={q.to_currency}
              className="rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {q.to_currency}
              </p>
              <p className="text-sm font-semibold text-slate-900">{q.label}</p>
              <p className="mt-1 font-mono text-sm text-blue-800">
                US$ 1 = {q.symbol} {formatExchangeRate(q.rate, q.to_currency)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Cotações indisponíveis.</p>
      )}

      {totalUsd != null && totalUsd > 0 && data?.rates?.length ? (
        <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-200/80 pt-3 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Total da venda em outras moedas:</span>
          {data.rates
            .filter((q) => q.to_currency !== "USD")
            .map((q) => {
              const converted = totalUsd * q.rate;
              return (
                <span key={q.to_currency}>
                  {q.symbol} {formatExchangeRate(converted, q.to_currency)}
                </span>
              );
            })}
        </div>
      ) : null}
    </section>
  );
}
