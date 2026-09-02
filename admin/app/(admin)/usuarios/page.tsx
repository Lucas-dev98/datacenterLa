"use client";

import { FormEvent, useEffect, useState } from "react";
import { useCreateUser, useUpdateUser } from "@/hooks/use-auth-mutations";
import { useUsersAdmin } from "@/hooks/use-users-admin";
import type { User } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

function roleIds(user: User): string[] {
  if (!user.roles?.length) return [];
  if (typeof user.roles[0] === "string") return user.roles as string[];
  return (user.roles as { id: string }[]).map((r) => r.id);
}

export default function UsuariosPage() {
  const { data, error: loadError, refetch } = useUsersAdmin();
  const users = data?.users ?? [];
  const roles = data?.roles ?? [];
  const [error, setError] = useState("");
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleEdits, setRoleEdits] = useState<Record<string, string[]>>({});
  const { run: createUser, loading: creating } = useCreateUser();
  const { run: updateUser, loading: updating } = useUpdateUser();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  useEffect(() => {
    if (!data) return;
    setRoleEdits(Object.fromEntries(data.users.map((user) => [user.id, roleIds(user)])));
    if (data.roles.length && !roleId) setRoleId(data.roles[0].id);
  }, [data, roleId]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createUser({
        email,
        password,
        full_name: fullName,
        role_ids: roleId ? [roleId] : [],
      });
      setEmail("");
      setPassword("");
      setFullName("");
      toast.push("Usuário criado", "success");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    }
  }

  async function toggleActive(user: User) {
    setPendingUserId(user.id);
    setError("");
    try {
      await updateUser({ id: user.id, body: { is_active: !user.is_active } });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setPendingUserId(null);
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
    setPendingUserId(userId);
    setError("");
    try {
      await updateUser({ id: userId, body: { role_ids: ids } });
      toast.push("Perfis atualizados", "success");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfis");
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Usuários</h1>
        <p className="mt-1 text-sm text-slate-600">Gestão de contas internas e roles</p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card title="Novo usuário">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateUser}>
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
            <Button type="submit" disabled={creating}>
              {creating ? "Criando…" : "Criar usuário"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Usuários cadastrados">
        <div className="space-y-4">
          {users.map((u) => {
            const selected = roleEdits[u.id] ?? [];
            const savedIds = roleIds(u);
            const dirty = selected.length !== savedIds.length || selected.some((id) => !savedIds.includes(id));
            const rowBusy = updating && pendingUserId === u.id;
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
                    className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                    disabled={rowBusy}
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
                        disabled={rowBusy}
                        onClick={() => void saveRoles(u.id)}
                      >
                        {rowBusy ? "Salvando…" : "Salvar perfis"}
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
