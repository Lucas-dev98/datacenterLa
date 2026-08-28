"use client";

import { FormEvent, useState } from "react";
import { submitQuote } from "@/lib/api";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ShopShell } from "@/components/shop-shell";

export default function ContatoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitQuote({ name, email, phone, company, message });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ShopShell crumbs={[{ label: "Cotação" }]}>
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Solicitar cotação</h1>
          <p className="mt-2 text-sm text-slate-600">
            Envie o modelo, marca ou o requisito técnico. Respondemos em menos de 24 horas.
          </p>
        </header>

        {ok ? (
          <Alert tone="success">
            Cotação recebida. Nossa equipe entra em contato em breve.
          </Alert>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Empresa">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">O que você precisa?</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2"
                placeholder="Ex.: Dell PowerEdge R740, 2x Xeon, 256GB RAM, envio para São Paulo…"
              />
            </label>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando…" : "Enviar cotação"}
            </Button>
            <p className="text-xs text-slate-500">Informe e-mail ou telefone para retornarmos o contato.</p>
          </form>
        )}
      </div>
    </ShopShell>
  );
}
