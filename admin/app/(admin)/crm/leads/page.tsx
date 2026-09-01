"use client";

import { FormEvent, useEffect, useState } from "react";
import { useCreateLead, useUpdateLeadStatus } from "@/hooks/use-lead-mutations";
import { useLeadsList } from "@/hooks/use-leads-list";
import { Alert, Button, Card, Field, Input, Table } from "@/components/ui";

export default function LeadsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { data: items, error: loadError, loading, refetch } = useLeadsList();
  const { run: createLead, loading: creating } = useCreateLead();
  const { run: updateStatus, loading: updating } = useUpdateLeadStatus();
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createLead({ name, email: email || undefined, source: "admin" });
      setName("");
      setEmail("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function setStatus(id: string, status: string) {
    setPendingId(id);
    setError("");
    try {
      await updateStatus({ id, status });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setPendingId(null);
    }
  }

  const rows = items ?? [];

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
          <div className="flex items-end">
            <Button type="submit" disabled={creating}>
              {creating ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Pipeline">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : (
          <Table
            headers={["Nome", "E-mail", "Status", "Origem", "Data", ""]}
            rows={rows.map((l) => [
              l.name,
              l.email ?? "—",
              l.status,
              l.source,
              new Date(l.created_at).toLocaleDateString("pt-BR"),
              l.status === "new" ? (
                <button
                  key="q"
                  type="button"
                  className="text-blue-600 hover:underline disabled:opacity-50"
                  disabled={updating && pendingId === l.id}
                  onClick={() => void setStatus(l.id, "qualified")}
                >
                  Qualificar
                </button>
              ) : "—",
            ])}
          />
        )}
      </Card>
    </div>
  );
}
