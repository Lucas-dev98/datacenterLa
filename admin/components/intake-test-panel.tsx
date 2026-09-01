"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BatchPhotoUploader, type BatchPhotoDraft } from "@/components/intake-batch-photos";
import { useIntakeTestFail, useIntakeTestPass } from "@/hooks/use-stock-intake-mutations";
import { Alert, Button, Field, Input } from "@/components/ui";

type Props = {
  unitId: string;
  unitCode: string;
  onDone: () => void;
};

export function IntakeTestPanel({ unitId, unitCode, onDone }: Props) {
  const [photos, setPhotos] = useState<BatchPhotoDraft[]>([]);
  const [reason, setReason] = useState("");
  const [showFail, setShowFail] = useState(false);
  const [error, setError] = useState("");
  const { run: passTest, loading: passing } = useIntakeTestPass();
  const { run: failTest, loading: failing } = useIntakeTestFail();
  const busy = passing || failing;

  function buildForm() {
    const form = new FormData();
    photos.forEach((photo, index) => {
      form.append(`test_photo_${index}`, photo.file);
    });
    return form;
  }

  async function handlePass(e: FormEvent) {
    e.preventDefault();
    if (photos.length === 0) {
      setError("Anexe ao menos uma foto do teste.");
      return;
    }
    setError("");
    try {
      await passTest({ unitId, form: buildForm() });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar teste");
    }
  }

  async function handleFail(e: FormEvent) {
    e.preventDefault();
    if (photos.length === 0) {
      setError("Anexe fotos do teste que falhou.");
      return;
    }
    if (!reason.trim()) {
      setError("Informe o motivo da reprovação.");
      return;
    }
    setError("");
    try {
      const form = buildForm();
      form.append("reason", reason.trim());
      await failTest({ unitId, form });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setShowFail(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar reprovação");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <p className="text-sm font-medium text-amber-950">
        Teste de {unitCode} — anexe evidências antes de aprovar ou reprovar
      </p>
      {error ? (
        <div className="mt-2">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <div className="mt-3">
        <BatchPhotoUploader photos={photos} variant="rma" maxPhotos={5} onChange={setPhotos} />
      </div>
      {!showFail ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={(e) => void handlePass(e)}>
            Aprovou teste
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowFail(true)}>
            Reprovou teste
          </Button>
        </div>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={handleFail}>
          <Field label="Motivo da reprovação">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva a falha encontrada no teste"
              required
            />
          </Field>
          <p className="text-xs text-amber-900">
            A unidade será bloqueada e abriremos uma{" "}
            <Link href="/estoque/entrada/devolucoes-fornecedor" className="font-medium underline">
              devolução ao fornecedor
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              Confirmar reprovação
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowFail(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
