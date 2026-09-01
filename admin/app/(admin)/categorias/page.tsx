"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pimApi } from "@/lib/api/pim";
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

type CategoryRow = Category & { depth: number; childCount: number };

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
      const childCount = (byParent.get(c.id) ?? []).length;
      out.push({ ...c, depth, childCount });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

function visibleCategoryRows(rows: CategoryRow[], expanded: Set<string>): CategoryRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: CategoryRow[] = [];
  for (const row of rows) {
    if (!row.parent_id) {
      out.push(row);
      continue;
    }
    let ancestorId: string | null | undefined = row.parent_id;
    let visible = true;
    while (ancestorId) {
      if (!expanded.has(ancestorId)) {
        visible = false;
        break;
      }
      ancestorId = byId.get(ancestorId)?.parent_id;
    }
    if (visible) out.push(row);
  }
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [managingParentId, setManagingParentId] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [childCode, setChildCode] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const parentOptions = useMemo(() => sortCategoryTree(items), [items]);
  const treeRows = useMemo(() => sortCategoryTree(items), [items]);
  const visibleRows = useMemo(() => visibleCategoryRows(treeRows, expanded), [treeRows, expanded]);
  const parentsWithChildren = useMemo(
    () => treeRows.filter((c) => c.childCount > 0).map((c) => c.id),
    [treeRows],
  );
  const managingParent = useMemo(
    () => (managingParentId ? items.find((c) => c.id === managingParentId) ?? null : null),
    [items, managingParentId],
  );
  const managedChildren = useMemo(
    () =>
      managingParentId
        ? items
            .filter((c) => c.is_active && c.parent_id === managingParentId)
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        : [],
    [items, managingParentId],
  );
  const allSelected = visibleRows.length > 0 && visibleRows.every((c) => selected.has(c.id));
  const selectedRows = useMemo(
    () => treeRows.filter((c) => selected.has(c.id)),
    [treeRows, selected],
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openParent(category: Category) {
    setManagingParentId(category.id);
    setExpanded((prev) => new Set(prev).add(category.id));
    setChildName("");
    setChildCode("");
    setError("");
    setConfirmDelete(false);
  }

  function closeParentPanel() {
    setManagingParentId(null);
    setChildName("");
    setChildCode("");
  }

  function expandAll() {
    setExpanded(new Set(parentsWithChildren));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await pimApi.listCategories();
      setItems(res.items ?? []);
      setSelected(new Set());
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmDelete(false);
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleRows.map((c) => c.id)));
    setConfirmDelete(false);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await pimApi.createCategory({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        parent_id: parentId || null,
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

  async function createChild(e: FormEvent) {
    e.preventDefault();
    if (!managingParentId) return;
    setError("");
    try {
      await pimApi.createCategory({
        code: childCode.trim().toUpperCase(),
        name: childName.trim(),
        parent_id: managingParentId,
      });
      setChildName("");
      setChildCode("");
      flash("Subcategoria incluída.");
      setExpanded((prev) => new Set(prev).add(managingParentId));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao incluir filho");
    }
  }

  async function removeChild(child: Category) {
    setError("");
    setDeleting(true);
    try {
      await pimApi.deleteCategory(child.id);
      flash(`Subcategoria ${child.code} removida.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover filho");
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(category: Category) {
    setEditing(category);
    setEditName(category.name);
    setEditParentId(category.parent_id ?? "");
    setEditActive(category.is_active);
    setError("");
    setConfirmDelete(false);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await pimApi.updateCategory(editing.id, {
        name: editName.trim(),
        parent_id: editParentId || null,
        is_active: editActive,
      });
      setEditing(null);
      flash("Categoria atualizada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar categoria");
    }
  }

  async function deleteSelected() {
    if (selectedRows.length === 0) return;
    setDeleting(true);
    setError("");
    setSuccess("");
    const failed: string[] = [];
    let ok = 0;
    const ordered = [...selectedRows].sort((a, b) => b.depth - a.depth);
    for (const cat of ordered) {
      try {
        await pimApi.deleteCategory(cat.id);
        ok += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "erro";
        failed.push(`${cat.code}: ${msg}`);
      }
    }
    setDeleting(false);
    setConfirmDelete(false);
    if (ok > 0) flash(`${ok} categoria(s) removida(s).`);
    if (failed.length > 0) {
      setError(`Não foi possível apagar ${failed.length}: ${failed.join(" · ")}`);
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Categorias</h1>
        <p className="mt-1 text-sm text-slate-600">
          Clique no nome da categoria pai para abrir, incluir ou remover filhos.
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

      {managingParent ? (
        <Card title={`Filhos de ${managingParent.name}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Código <span className="font-mono">{managingParent.code}</span> · {managedChildren.length}{" "}
              subcategoria(s)
            </p>
            <Button type="button" variant="secondary" onClick={closeParentPanel}>
              Fechar
            </Button>
          </div>

          <form
            className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"
            onSubmit={(e) => void createChild(e)}
          >
            <Field label="Nome do filho">
              <Input
                value={childName}
                onChange={(e) => {
                  setChildName(e.target.value);
                  if (!childCode.trim()) setChildCode(slugCode(e.target.value));
                }}
                placeholder="Ex.: Fonte ATX"
                required
              />
            </Field>
            <Field label="Código">
              <Input
                value={childCode}
                onChange={(e) => setChildCode(e.target.value.toUpperCase())}
                placeholder="FONTE_ATX"
                required
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Incluir filho</Button>
            </div>
          </form>

          {managedChildren.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum filho ainda — use o formulário acima para incluir.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {managedChildren.map((child) => (
                <li key={child.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{child.code}</span>
                    <p className="font-medium text-slate-900">{child.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(child)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline disabled:text-slate-400"
                      disabled={deleting}
                      onClick={() => void removeChild(child)}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

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

      <Card title={`Categorias (${treeRows.length})`}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {parentsWithChildren.length > 0 ? (
            <>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={expandAll}>
                Expandir todas
              </button>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={collapseAll}>
                Recolher todas
              </button>
            </>
          ) : null}
          {selected.size > 0 ? (
            <Button type="button" variant="danger" disabled={deleting} onClick={() => setConfirmDelete(true)}>
              Apagar selecionadas ({selected.size})
            </Button>
          ) : null}
          {selected.size > 0 ? (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => setSelected(new Set())}
            >
              Limpar seleção
            </button>
          ) : null}
        </div>

        {confirmDelete && selected.size > 0 ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">
              Apagar <strong>{selected.size}</strong> categoria(s)? Categorias com subcategorias ou produtos
              ativos não podem ser removidas.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="danger" disabled={deleting} onClick={() => void deleteSelected()}>
                {deleting ? "Apagando…" : "Confirmar exclusão"}
              </Button>
              <Button type="button" variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : treeRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma categoria cadastrada. Use o formulário acima.</p>
        ) : (
          <Table
            headers={[
              <input
                key="all"
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Selecionar todas visíveis"
              />,
              "Código",
              "Nome",
              "Pai",
              "Status",
              "",
            ]}
            rows={visibleRows.map((c) => {
              const isOpen = expanded.has(c.id);
              const isManaging = managingParentId === c.id;
              return [
                <input
                  key={`cb-${c.id}`}
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  aria-label={`Selecionar ${c.code}`}
                />,
                <span key="code" className="font-mono text-xs">
                  {c.code}
                </span>,
                <span
                  key="name"
                  className="inline-flex items-center gap-1.5"
                  style={{ paddingLeft: `${c.depth * 1.25}rem` }}
                >
                  {c.childCount > 0 || !c.parent_id ? (
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? `Recolher ${c.name}` : `Expandir ${c.name}`}
                      onClick={() => toggleExpand(c.id)}
                    >
                      {isOpen ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="inline-block w-6 shrink-0 text-center text-slate-300">↳</span>
                  )}
                  <button
                    type="button"
                    className={`text-left font-medium hover:underline ${
                      isManaging ? "text-blue-700" : "text-slate-900"
                    }`}
                    onClick={() => openParent(c)}
                    title="Abrir painel de filhos"
                  >
                    {c.name}
                    {c.childCount > 0 ? (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">({c.childCount})</span>
                    ) : null}
                  </button>
                </span>,
                categoryLabel(items, c.parent_id),
                c.is_active ? (
                  <span className="text-emerald-700">Ativa</span>
                ) : (
                  <span className="text-slate-400">Inativa</span>
                ),
                <span key="actions" className="flex flex-wrap gap-2">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => openParent(c)}>
                    Filhos
                  </button>
                  <Link href={`/categorias/${c.id}`} className="text-blue-600 hover:underline">
                    Atributos
                  </Link>
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(c)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:text-slate-400"
                    disabled={deleting}
                    onClick={() => {
                      setSelected(new Set([c.id]));
                      setConfirmDelete(true);
                    }}
                  >
                    Apagar
                  </button>
                </span>,
              ];
            })}
          />
        )}
      </Card>
    </div>
  );
}
