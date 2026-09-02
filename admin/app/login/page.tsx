"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/client";
import { saveTokens } from "@/lib/auth";
import type { TokenPair } from "@/lib/types";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === "development";
  const [email, setEmail] = useState(isDev ? "admin@datacenterla.local" : "");
  const [password, setPassword] = useState(isDev ? "Admin@12345678" : "");
  const [mfaCode, setMfaCode] = useState("");
  const [needMfa, setNeedMfa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function finishLogin(tokens: TokenPair) {
    saveTokens(tokens);
    if (tokens.mfa_setup_required) {
      localStorage.setItem("dcla_mfa_setup", "1");
      router.replace("/configuracoes/seguranca");
      return;
    }
    localStorage.removeItem("dcla_mfa_setup");
    router.replace("/");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await login(email, password, needMfa ? mfaCode : undefined);
      await finishLogin(tokens);
    } catch (err) {
      const apiErr = err as { code?: string; status?: number; message?: string };
      if (apiErr.code === "MFA_REQUIRED" || (err instanceof Error && err.message.includes("mfa"))) {
        setNeedMfa(true);
        setError("Informe o código do autenticador");
      } else {
        setError(err instanceof Error ? err.message : "Falha no login");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-200">
        <div className="space-y-1 pb-2">
          <p className="text-xs uppercase tracking-wider text-slate-500">Data Center LA</p>
          <h1 className="text-xl font-semibold text-slate-900">Admin ERP</h1>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={needMfa} />
          </Field>
          <Field label="Senha">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={needMfa} />
          </Field>
          {needMfa ? (
            <Field label="Código MFA">
              <Input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required pattern="[0-9]{6}" autoFocus />
            </Field>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando…" : needMfa ? "Confirmar MFA" : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
