"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
import {
  PARAGUAY_BUYER_KINDS,
  type ParaguayanBuyerKind,
} from "@/lib/paraguay-documents";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { DocumentScanCapture } from "@/components/document-scan-capture";

type Props = {
  onCreated: (customer: Customer) => void;
  onClose: () => void;
  initialResidency?: "paraguayan" | "foreigner" | "";
  initialDocument?: string;
};

const NATIONALITIES = [
  { value: "BR", label: "Brasil" },
  { value: "AR", label: "Argentina" },
  { value: "UY", label: "Uruguai" },
  { value: "US", label: "Estados Unidos" },
  { value: "CL", label: "Chile" },
  { value: "BO", label: "Bolívia" },
  { value: "OT", label: "Outro" },
];

export function PDVCustomerModal({ onCreated, onClose, initialResidency = "", initialDocument = "" }: Props) {
  const [residency, setResidency] = useState<"paraguayan" | "foreigner" | "">(initialResidency);
  const [nationality, setNationality] = useState(initialResidency === "paraguayan" ? "PY" : "BR");
  const [paraguayanKind, setParaguayanKind] = useState<ParaguayanBuyerKind>("pf_ci");
  const [documentType, setDocumentType] = useState(initialResidency === "paraguayan" ? "ci_py" : "cpf");
  const [name, setName] = useState("");
  const [documentId, setDocumentId] = useState(initialDocument);
  const [phone, setPhone] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const brazilian = residency === "foreigner" && nationality === "BR";
  const paraguayanMeta = useMemo(
    () => PARAGUAY_BUYER_KINDS.find((k) => k.value === paraguayanKind) ?? PARAGUAY_BUYER_KINDS[0],
    [paraguayanKind],
  );

  const docOptions = useMemo(() => {
    if (residency === "paraguayan") {
      return PARAGUAY_BUYER_KINDS.map((k) => ({ value: k.documentType, label: k.label }));
    }
    if (nationality === "BR") {
      return [
        { value: "cpf", label: "CPF" },
        { value: "rg", label: "RG" },
        { value: "passport", label: "Passaporte" },
      ];
    }
    if (nationality === "AR") {
      return [
        { value: "dni", label: "DNI" },
        { value: "passport", label: "Passaporte" },
      ];
    }
    return [
      { value: "passport", label: "Passaporte" },
      { value: "dni", label: "DNI" },
      { value: "other", label: "Outro documento" },
    ];
  }, [residency, nationality]);

  function chooseResidency(value: "paraguayan" | "foreigner") {
    setResidency(value);
    if (value === "paraguayan") {
      setNationality("PY");
      setParaguayanKind("pf_ci");
      setDocumentType("ci_py");
    } else {
      setNationality("BR");
      setDocumentType("cpf");
    }
  }

  function chooseParaguayanKind(kind: ParaguayanBuyerKind) {
    setParaguayanKind(kind);
    const meta = PARAGUAY_BUYER_KINDS.find((k) => k.value === kind);
    if (meta) setDocumentType(meta.documentType);
  }

  function onScan(file: File | null) {
    setScanFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  const scanLabel =
    residency === "paraguayan"
      ? paraguayanKind === "pj_ruc"
        ? "Escanear cartão RUC ou documento da empresa"
        : paraguayanKind === "pf_ruc"
          ? "Escanear C.I. ou comprovante de RUC"
          : "Escanear Cédula de Identidad (C.I.)"
      : brazilian
        ? "Escanear documento brasileiro"
        : "Escanear documento";

  const scanHint =
    residency === "paraguayan"
      ? "Fotografe a C.I. ou o cartão RUC. A imagem fica anexada ao cadastro e pode ser consultada depois."
      : brazilian
        ? "Use a câmera ou o scanner para fotografar RG, CPF ou passaporte. A imagem fica no cadastro."
        : "Fotografe o passaporte ou documento de identidade. A imagem fica anexada ao cadastro.";

  const scanTone = residency === "paraguayan" ? "blue" : brazilian ? "amber" : "slate";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!residency) {
      setError("Escolha Paraguaio ou Estrangeiro");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const effectiveDocType = residency === "paraguayan" ? paraguayanMeta.documentType : documentType;
      const customer = await api<Customer>("/api/v1/sales/pos/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phone.trim() || undefined,
          document_id: documentId.trim() || undefined,
          residency,
          nationality: residency === "paraguayan" ? "PY" : nationality,
          document_type: effectiveDocType,
          type: effectiveDocType === "ruc_pj" ? "b2b" : "b2c",
        }),
      });
      if (scanFile) {
        const form = new FormData();
        form.append("file", scanFile);
        await api<Customer>(`/api/v1/sales/pos/customers/${customer.id}/document-scan`, {
          method: "POST",
          body: form,
        });
        customer.has_document_scan = true;
      }
      onCreated(customer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="customer-modal-title" className="text-lg font-semibold text-slate-900">
          Cadastro do cliente
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          1. Perfil · 2. Documento fiscal · 3. Nome. Depois a venda segue para os produtos.
        </p>

        {error ? (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`rounded-xl border-2 px-3 py-4 text-center text-sm font-semibold ${
              residency === "paraguayan"
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => chooseResidency("paraguayan")}
          >
            Paraguaio
            <span className="mt-1 block text-xs font-normal text-slate-500">C.I. ou RUC</span>
          </button>
          <button
            type="button"
            className={`rounded-xl border-2 px-3 py-4 text-center text-sm font-semibold ${
              residency === "foreigner"
                ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => chooseResidency("foreigner")}
          >
            Estrangeiro
            <span className="mt-1 block text-xs font-normal text-slate-500">Brasil, Argentina…</span>
          </button>
        </div>

        {residency ? (
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            {residency === "paraguayan" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800">Tipo de comprador paraguaio</p>
                <div className="grid gap-2">
                  {PARAGUAY_BUYER_KINDS.map((kind) => (
                    <button
                      key={kind.value}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${
                        paraguayanKind === kind.value
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                      onClick={() => chooseParaguayanKind(kind.value)}
                    >
                      <span className="font-medium">{kind.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-600">{kind.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Field label="Nacionalidade">
                <Select
                  value={nationality}
                  onChange={(e) => {
                    setNationality(e.target.value);
                    if (e.target.value === "BR") setDocumentType("cpf");
                    else if (e.target.value === "AR") setDocumentType("dni");
                    else setDocumentType("passport");
                  }}
                >
                  {NATIONALITIES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label={residency === "paraguayan" ? paraguayanMeta.nameLabel : "Nome completo"}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>

            {residency === "foreigner" ? (
              <Field label="Tipo de documento">
                <Select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                  {docOptions.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field
              label={residency === "paraguayan" ? paraguayanMeta.documentLabel : "Número do documento"}
              hint={
                residency === "paraguayan"
                  ? paraguayanMeta.hint
                  : brazilian
                    ? "Digite o CPF/RG após escanear, se o leitor não preencher sozinho"
                    : undefined
              }
            >
              <Input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                required
                placeholder={
                  residency === "paraguayan" ? paraguayanMeta.documentPlaceholder : brazilian ? "CPF ou RG" : "Número"
                }
              />
            </Field>

            <DocumentScanCapture
              label={scanLabel}
              hint={scanHint}
              preview={preview}
              fileName={scanFile?.name}
              tone={scanTone}
              onCapture={onScan}
            />

            <Field label="Telefone (opcional)">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando…" : "Usar nesta venda"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        {!residency ? (
          <div className="mt-5 text-right">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
