"use client";

import { FormEvent, useEffect, useState } from "react";
import { salesApi } from "@/lib/api/sales";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

type Lead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
  source: string;
  created_at: string;
};

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await salesApi.listLeads();
    setItems(res.items ?? []);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Erro"));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await salesApi.createLead({ name, email: email || undefined, source: "admin" });
      setName("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function setStatus(id: string, status: string) {
    await salesApi.updateLeadStatus(id, status);
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">CRM — Leads</h1>
      </header>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card title="Novo lead">
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={create}>
          <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="flex items-end"><Button type="submit">Salvar</Button></div>
        </form>
      </Card>

      <Card title="Pipeline">
        <Table
          headers={["Nome", "E-mail", "Status", "Origem", "Data", ""]}
          rows={items.map((l) => [
            l.name,
            l.email ?? "—",
            l.status,
            l.source,
            new Date(l.created_at).toLocaleDateString("pt-BR"),
            l.status === "new" ? (
              <button key="q" type="button" className="text-blue-600 hover:underline" onClick={() => void setStatus(l.id, "qualified")}>Qualificar</button>
            ) : "—",
          ])}
        />
      </Card>
    </div>
  );
}
