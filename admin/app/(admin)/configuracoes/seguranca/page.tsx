"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function SegurancaPage() {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [step, setStep] = useState<"idle" | "setup">("idle");

  async function startSetup() {
    setError("");
    try {
      const res = await authApi.mfaSetup();
      setSecret(res.secret);
      setUrl(res.url);
      setStep("setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar MFA");
    }
  }

  async function enableMfa(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await authApi.mfaEnable(code);
      localStorage.removeItem("dcla_mfa_setup");
      setInfo("MFA ativado com sucesso");
      await refreshUser();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    }
  }

  useEffect(() => {
    void startSetup();
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Segurança — MFA</h1>
        <p className="mt-1 text-sm text-slate-600">Autenticação em dois fatores obrigatória para staff</p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title="Configurar autenticador">
        {step === "setup" ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Adicione no Google Authenticator / Authy:</p>
            <p className="break-all font-mono text-xs text-slate-800">{secret}</p>
            {url ? <p className="break-all text-xs text-slate-500">{url}</p> : null}
            <form onSubmit={enableMfa} className="space-y-4">
              <Field label="Código de 6 dígitos">
                <Input value={code} onChange={(e) => setCode(e.target.value)} required pattern="[0-9]{6}" />
              </Field>
              <Button type="submit">Ativar MFA</Button>
            </form>
          </div>
        ) : (
          <Button type="button" onClick={() => void startSetup()}>Gerar QR / secret</Button>
        )}
      </Card>
    </div>
  );
}
