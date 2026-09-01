"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { pimApi } from "@/lib/api/pim";
import type { CategoryAttribute } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

export default function CategoriaDetailPage() {
  const params = useParams<{ id: string }>();
  const [attrs, setAttrs] = useState<CategoryAttribute[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState("text");
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await pimApi.listCategoryAttributes(params.id);
      setAttrs(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await pimApi.createCategoryAttribute(params.id, {
        code,
        name,
        data_type: dataType,
        is_required: false,
        sort_order: attrs.length,
      });
      setCode("");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/categorias" className="text-sm text-blue-600 hover:underline">← Categorias</Link>
      <h1 className="text-2xl font-semibold">Atributos da categoria</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card title="Novo atributo">
        <form className="grid gap-4 sm:grid-cols-4" onSubmit={create}>
          <Field label="Código"><Input value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
          <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Tipo">
            <Select value={dataType} onChange={(e) => setDataType(e.target.value)}>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="boolean">Sim/Não</option>
            </Select>
          </Field>
          <div className="flex items-end"><Button type="submit">Adicionar</Button></div>
        </form>
      </Card>

      <Card title="Atributos">
        <Table
          headers={["Código", "Nome", "Tipo", "Obrigatório"]}
          rows={attrs.map((a) => [a.code, a.name, a.data_type, a.is_required ? "Sim" : "Não"])}
        />
      </Card>
    </div>
  );
}
