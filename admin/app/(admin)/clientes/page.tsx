"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { documentTypeLabel } from "@/lib/customer-profile";
import { PARAGUAY_BUYER_KINDS } from "@/lib/paraguay-documents";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

export default function ClientesPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("b2b");
  const [phone, setPhone] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [residency, setResidency] = useState("paraguayan");
  const [nationality, setNationality] = useState("PY");
  const [documentType, setDocumentType] = useState("ci_py");
  const [creditLimit, setCreditLimit] = useState("50000");
  const [terms, setTerms] = useState("30");

  const documentOptions = useMemo(() => {
    if (residency === "paraguayan") {
      return PARAGUAY_BUYER_KINDS.map((k) => ({ value: k.documentType, label: k.label }));
    }
    return [
      { value: "cpf", label: "CPF" },
      { value: "rg", label: "RG" },
      { value: "dni", label: "DNI" },
      { value: "passport", label: "Passaporte" },
      { value: "other", label: "Outro" },
    ];
  }, [residency]);

  const nameLabel =
    residency === "paraguayan" && documentType === "ruc_pj" ? "Razão social" : "Nome";

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
          phone: phone || undefined,
          document_id: documentId || undefined,
          residency,
          nationality,
          document_type: documentType,
          credit_limit_usd: parseFloat(creditLimit) || 0,
          payment_terms_days: parseInt(terms, 10) || 30,
        }),
      });
      setInfo("Cliente criado");
      setName("");
      setEmail("");
      setPhone("");
      setDocumentId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cadastro para PDV, cotações e pedidos. Informe se é paraguaio ou estrangeiro e o documento.
          </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Novo cliente">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
          <Field label={nameLabel}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Tipo">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="b2b">B2B</option>
              <option value="b2c">B2C</option>
              <option value="reseller">Revendedor</option>
            </Select>
          </Field>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Perfil">
            <Select
              value={residency}
              onChange={(e) => {
                setResidency(e.target.value);
                if (e.target.value === "paraguayan") {
                  setNationality("PY");
                  setDocumentType("ci_py");
                  setType("b2c");
                } else {
                  setNationality("BR");
                  setDocumentType("cpf");
                }
              }}
            >
              <option value="paraguayan">Paraguaio</option>
              <option value="foreigner">Estrangeiro</option>
            </Select>
          </Field>
          <Field label="Nacionalidade">
            <Select value={nationality} onChange={(e) => setNationality(e.target.value)}>
              <option value="PY">Paraguay</option>
              <option value="BR">Brasil</option>
              <option value="AR">Argentina</option>
              <option value="UY">Uruguai</option>
              <option value="OT">Outro</option>
            </Select>
          </Field>
          <Field label="Tipo de documento">
            <Select
              value={documentType}
              onChange={(e) => {
                const next = e.target.value;
                setDocumentType(next);
                if (residency === "paraguayan" && next === "ruc_pj") setType("b2b");
                else if (residency === "paraguayan") setType("b2c");
              }}
            >
              {documentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Número do documento">
            <Input
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder={
                documentType === "ci_py"
                  ? "Cédula de Identidad"
                  : documentType === "ruc_pj" || documentType === "ruc_pf"
                    ? "RUC"
                    : undefined
              }
            />
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
            headers={["Nome", "Perfil", "Documento", "Tipo", "E-mail"]}
            rows={items.map((c) => [
              c.name,
              c.residency === "paraguayan" ? "Paraguaio" : c.residency === "foreigner" ? "Estrangeiro" : "—",
              c.document_id ? `${documentTypeLabel(c.document_type)} ${c.document_id}` : "—",
              c.type,
              c.email ?? "—",
            ])}
          />
        )}
      </Card>
    </div>
  );
}
