"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

function slugCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

function categoryLabel(items: Category[], id?: string | null): string {
  if (!id) return "—";
  return items.find((c) => c.id === id)?.name ?? "—";
}

type CategoryRow = Category & { depth: number };

function sortCategoryTree(items: Category[]): CategoryRow[] {
  const active = items.filter((c) => c.is_active);
  const byParent = new Map<string | null, Category[]>();
  for (const c of active) {
    const key = c.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  const out: CategoryRow[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

export default function CategoriasPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const parentOptions = useMemo(() => sortCategoryTree(items), [items]);
  const treeRows = useMemo(
    () => sortCategoryTree(items.filter((c) => c.is_active || editing?.id === c.id)),
    [items, editing?.id],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ items: Category[] }>("/api/v1/pim/categories");
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/v1/pim/categories", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          parent_id: parentId || null,
        }),
      });
      setCode("");
      setName("");
      setParentId("");
      flash("Categoria criada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria");
    }
  }

  function startEdit(category: Category) {
    setEditing(category);
    setEditName(category.name);
    setEditParentId(category.parent_id ?? "");
    setEditActive(category.is_active);
    setError("");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await api(`/api/v1/pim/categories/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          parent_id: editParentId || null,
          is_active: editActive,
        }),
      });
      setEditing(null);
      flash("Categoria atualizada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar categoria");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Categorias</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cadastro mestre de categorias do catálogo. Categorias com produtos publicados no e-commerce aparecem na loja.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Card title="Nova categoria">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => void create(e)}>
          <Field label="Nome" hint="Ex.: Servidores, Memória, Redes">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!code.trim()) setCode(slugCode(e.target.value));
              }}
              placeholder="Servidores"
              required
            />
          </Field>
          <Field label="Código" hint="Identificador único (maiúsculas)">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SERVIDORES"
              required
            />
          </Field>
          <Field label="Categoria pai" hint="Opcional — para subcategorias">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Nenhuma (categoria raiz)</option>
              {parentOptions
                .filter((c) => !c.parent_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit">Criar categoria</Button>
          </div>
        </form>
      </Card>

      {editing ? (
        <Card title={`Editar — ${editing.code}`}>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => void saveEdit(e)}>
            <Field label="Nome">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </Field>
            <Field label="Categoria pai">
              <Select value={editParentId} onChange={(e) => setEditParentId(e.target.value)}>
                <option value="">Nenhuma (raiz)</option>
                {parentOptions
                  .filter((c) => c.id !== editing?.id && !c.parent_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={editActive ? "active" : "inactive"}
                onChange={(e) => setEditActive(e.target.value === "active")}
              >
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
              </Select>
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title={`Categorias (${items.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma categoria cadastrada. Use o formulário acima.</p>
        ) : (
          <Table
            headers={["Código", "Nome", "Pai", "Status", ""]}
            rows={treeRows.map((c) => [
              <span key="code" className="font-mono text-xs">
                {c.code}
              </span>,
              <span key="name" style={{ paddingLeft: `${c.depth * 1.25}rem` }}>
                {c.depth > 0 ? "↳ " : ""}
                {c.name}
              </span>,
              categoryLabel(items, c.parent_id),
              c.is_active ? (
                <span className="text-emerald-700">Ativa</span>
              ) : (
                <span className="text-slate-400">Inativa</span>
              ),
              <span key="actions" className="flex flex-wrap gap-2">
                <Link href={`/categorias/${c.id}`} className="text-blue-600 hover:underline">
                  Atributos
                </Link>
                <button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(c)}>
                  Editar
                </button>
              </span>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}
