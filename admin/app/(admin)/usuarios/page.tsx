"use client";

import { FormEvent, useEffect, useState } from "react";
import { authApi, type Role } from "@/lib/api/auth";
import type { User } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

function roleIds(user: User): string[] {
  if (!user.roles?.length) return [];
  if (typeof user.roles[0] === "string") return user.roles as string[];
  return (user.roles as { id: string }[]).map((r) => r.id);
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleEdits, setRoleEdits] = useState<Record<string, string[]>>({});
  const [savingRoles, setSavingRoles] = useState<string | null>(null);

  async function load() {
    setError("");
    try {
      const [u, r] = await Promise.all([authApi.listUsers(), authApi.listRoles()]);
      const list = u.items ?? [];
      setUsers(list);
      setRoles(r.items ?? []);
      setRoleEdits(Object.fromEntries(list.map((user) => [user.id, roleIds(user)])));
      if (r.items?.length && !roleId) setRoleId(r.items[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setInfo("");
    try {
      await authApi.createUser({
        email,
        password,
        full_name: fullName,
        role_ids: roleId ? [roleId] : [],
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setInfo("Usuário criado");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    }
  }

  async function toggleActive(user: User) {
    try {
      await authApi.updateUser(user.id, { is_active: !user.is_active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  function toggleRole(userId: string, roleIdToToggle: string) {
    setRoleEdits((prev) => {
      const current = prev[userId] ?? [];
      const next = current.includes(roleIdToToggle)
        ? current.filter((id) => id !== roleIdToToggle)
        : [...current, roleIdToToggle];
      return { ...prev, [userId]: next };
    });
  }

  async function saveRoles(userId: string) {
    const ids = roleEdits[userId] ?? [];
    if (ids.length === 0) {
      setError("Selecione ao menos um perfil");
      return;
    }
    setSavingRoles(userId);
    setError("");
    setInfo("");
    try {
      await authApi.updateUser(userId, { role_ids: ids });
      setInfo("Perfis atualizados");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfis");
    } finally {
      setSavingRoles(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Usuários</h1>
        <p className="mt-1 text-sm text-slate-600">Gestão de contas internas e roles</p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Novo usuário">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={createUser}>
          <Field label="Nome">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Senha (mín. 12)">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
          </Field>
          <Field label="Perfil">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Criar usuário</Button>
          </div>
        </form>
      </Card>

      <Card title="Usuários cadastrados">
        <div className="space-y-4">
          {users.map((u) => {
            const selected = roleEdits[u.id] ?? [];
            const savedIds = roleIds(u);
            const dirty = selected.length !== savedIds.length || selected.some((id) => !savedIds.includes(id));
            return (
              <div key={u.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{u.full_name}</p>
                    <p className="text-sm text-slate-600">{u.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {u.is_active ? "Ativo" : "Inativo"} · MFA {u.mfa_enabled ? "sim" : "não"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline"
                    onClick={() => void toggleActive(u)}
                  >
                    {u.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Perfis</p>
                  <div className="flex flex-wrap gap-3">
                    {roles.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={() => toggleRole(u.id, r.id)}
                        />
                        {r.name}
                      </label>
                    ))}
                  </div>
                  {dirty ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={savingRoles === u.id}
                        onClick={() => void saveRoles(u.id)}
                      >
                        {savingRoles === u.id ? "Salvando…" : "Salvar perfis"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {users.length === 0 ? <p className="text-sm text-slate-500">Nenhum usuário.</p> : null}
        </div>
      </Card>
    </div>
  );
}
