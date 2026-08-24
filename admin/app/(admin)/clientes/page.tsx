"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

export default function ClientesPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("b2b");
  const [email, setEmail] = useState("");
  const [creditLimit, setCreditLimit] = useState("50000");
  const [terms, setTerms] = useState("30");

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ items: Customer[] }>("/api/v1/sales/customers?active_only=true");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await api("/api/v1/sales/customers", {
        method: "POST",
        body: JSON.stringify({
          type,
          name,
          email: email || undefined,
          credit_limit_usd: parseFloat(creditLimit) || 0,
          payment_terms_days: parseInt(terms, 10) || 30,
        }),
      });
      setInfo("Cliente criado");
      setName("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
        <p className="mt-1 text-sm text-slate-600">CRM — cadastro para cotações e pedidos B2B.</p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Novo cliente">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="b2b">B2B</option>
              <option value="b2c">B2C</option>
              <option value="reseller">Revendedor</option>
            </Select>
          </Field>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Limite crédito USD">
            <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          </Field>
          <Field label="Prazo pagamento (dias)">
            <Input type="number" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Criar cliente</Button>
          </div>
        </form>
      </Card>

      <Card title="Clientes ativos">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : (
          <Table
            headers={["Nome", "Tipo", "E-mail", "Crédito USD", "Prazo"]}
            rows={items.map((c) => [
              c.name,
              c.type,
              c.email ?? "—",
              `$${c.credit_limit_usd.toFixed(2)}`,
              `${c.payment_terms_days ?? 0} dias`,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
