"use client";

import Link from "next/link";
import { useState } from "react";
import { useSyncExchangeRates } from "@/hooks/use-pricing-mutations";
import { useExchangeRatesToday } from "@/hooks/use-exchange-rates-today";
import { formatExchangeRate } from "@/lib/exchange-rates";
import { useAuth } from "@/components/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { Alert, Button, Card } from "@/components/ui";

export default function FinanceiroCotacoesPage() {
  const { user } = useAuth();
  const canSync = hasPermission(user, "finance.exchange_rates.write");
  const { data, error: loadError, loading, setData } = useExchangeRatesToday();
  const { run: syncExchangeRates, loading: syncing } = useSyncExchangeRates();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const displayError = (() => {
    if (error) return error;
    if (!loadError) return "";
    if (loadError.includes("404") || loadError.includes("Not Found")) {
      return "Serviço de cotações indisponível. Reinicie o backend (porta 8082) e atualize a página.";
    }
    if (loadError.includes("401")) {
      return "Sessão expirada. Faça login novamente.";
    }
    return loadError;
  })();

  async function syncNow() {
    setError("");
    setInfo("");
    try {
      const res = await syncExchangeRates({});
      setData(res);
      setInfo("Cotações atualizadas automaticamente a partir do mercado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar cotações");
    }
  }

  const asOf = data?.as_of
    ? new Date(data.as_of).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const fetchedAt = data?.fetched_at
    ? new Date(data.fetched_at).toLocaleString("pt-BR")
    : null;

  const sourceLabel =
    data?.source === "market"
      ? "Mercado internacional (atualização automática)"
      : "Última cotação conhecida (mercado indisponível)";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
            <Link href="/financeiro" className="hover:underline">
              Financeiro
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Cotações do dia</h1>
          <p className="mt-1 text-sm text-slate-600">
            Buscadas automaticamente todo dia — usadas no PDV e nos preços em guaraní.
            {asOf ? <> Referência: <strong>{asOf}</strong>.</> : null}
          </p>
        </div>
        {canSync ? (
          <Button type="button" variant="secondary" disabled={syncing || loading} onClick={() => void syncNow()}>
            {syncing ? "Atualizando…" : "Atualizar agora"}
          </Button>
        ) : null}
      </header>

      {displayError ? <Alert tone="error">{displayError}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Referência atual (1 USD)">
        {loading ? (
          <p className="text-sm text-slate-500">Buscando cotações do mercado…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              {sourceLabel}
              {fetchedAt ? <> · Sincronizado em <strong>{fetchedAt}</strong>.</> : null}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(data?.rates ?? []).map((q) => (
                <div key={q.to_currency} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase text-slate-500">{q.to_currency}</p>
                  <p className="text-sm text-slate-700">{q.label}</p>
                  <p className="mt-1 font-mono text-base font-semibold text-slate-900">
                    {q.symbol} {formatExchangeRate(q.rate, q.to_currency)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Fonte: ExchangeRate-API (USD como base). Moedas: dólar, guaraní paraguayo, real brasileiro e
        peso argentino — aceitas no comércio local. Valores refletidos no{" "}
        <Link href="/vendas/pdv" className="text-blue-600 hover:underline">
          PDV
        </Link>
        .
      </p>
    </div>
  );
}
