"use client";

import type { Customer } from "@/lib/types";
import { customerProfileLabel, documentTypeLabel } from "@/lib/customer-profile";
import { paraguayanBuyerKindLabel } from "@/lib/paraguay-documents";
import { Button, Card, Field, Input } from "@/components/ui";

export type PdvBuyerProfile = "walkin" | "paraguayan" | "foreigner";

type Props = {
  profile: PdvBuyerProfile;
  onProfileChange: (profile: PdvBuyerProfile) => void;
  walkIn: Customer | null;
  customerQuery: string;
  onCustomerQueryChange: (value: string) => void;
  customerSearching: boolean;
  identifiedHits: Customer[];
  queryLockedToSelected: boolean;
  selectedCustomer: Customer | null;
  customerId: string;
  profileFallback?: string;
  onSelectCustomer: (customer: Customer) => void;
  onOpenRegisterModal: () => void;
};

export function PDVCustomerStep({
  profile,
  onProfileChange,
  walkIn,
  customerQuery,
  onCustomerQueryChange,
  customerSearching,
  identifiedHits,
  queryLockedToSelected,
  selectedCustomer,
  customerId,
  profileFallback,
  onSelectCustomer,
  onOpenRegisterModal,
}: Props) {
  return (
    <Card title="1. Cliente">
      <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-start">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
              profile === "paraguayan"
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => onProfileChange("paraguayan")}
          >
            Paraguaio
          </button>
          <button
            type="button"
            className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
              profile === "foreigner"
                ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => onProfileChange("foreigner")}
          >
            Estrangeiro
          </button>
          <button
            type="button"
            className={`rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
              profile === "walkin"
                ? "border-slate-700 bg-slate-100 text-slate-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => onProfileChange("walkin")}
          >
            Consumidor final
          </button>
        </div>

        <div className="space-y-3">
          {profile !== "walkin" ? (
            <>
              <Field
                label={profile === "paraguayan" ? "C.I., RUC ou nome" : "CPF, RG, passaporte ou nome"}
                hint={
                  profile === "paraguayan"
                    ? "Pessoa física: C.I. (consumidor final) ou RUC pessoal. Empresa: RUC com razão social."
                    : profile === "foreigner"
                      ? "Brasileiro: no cadastro, anexe a foto do documento se for cliente novo"
                      : undefined
                }
              >
                <Input
                  value={customerQuery}
                  autoFocus
                  placeholder="Digite ou leia o documento…"
                  onChange={(e) => onCustomerQueryChange(e.target.value)}
                />
              </Field>
              {identifiedHits.length > 0 && !queryLockedToSelected ? (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {identifiedHits.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm ${
                        c.id === customerId
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                      onClick={() => {
                        onSelectCustomer(c);
                        onCustomerQueryChange(c.document_id || c.name);
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-slate-500">
                        {customerProfileLabel(c, walkIn?.id, profileFallback)}
                        {c.document_id ? ` · ${documentTypeLabel(c.document_type)} ${c.document_id}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : customerSearching ? (
                <p className="text-sm text-slate-500">Buscando…</p>
              ) : customerQuery.trim() && !queryLockedToSelected ? (
                <p className="text-sm text-slate-500">Nenhum cadastro com esse documento.</p>
              ) : null}
              {selectedCustomer && selectedCustomer.id !== walkIn?.id ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <p className="font-medium">
                    {profile === "paraguayan" && selectedCustomer.document_type === "ci_py"
                      ? `${selectedCustomer.name} · comprovante como Consumidor Final`
                      : selectedCustomer.name}
                  </p>
                  <p>
                    {customerProfileLabel(selectedCustomer, walkIn?.id, profileFallback)}
                    {selectedCustomer.document_id
                      ? ` · ${documentTypeLabel(selectedCustomer.document_type)} ${selectedCustomer.document_id}`
                      : ""}
                    {selectedCustomer.has_document_scan ? " · documento escaneado" : ""}
                  </p>
                  {profile === "paraguayan" && selectedCustomer.document_type ? (
                    <p className="mt-1 text-xs text-emerald-800">
                      {paraguayanBuyerKindLabel(selectedCustomer.document_type)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <Button type="button" className="w-full sm:w-auto" onClick={onOpenRegisterModal}>
                  {customerQuery.trim() ? "Cadastrar este cliente" : "Cadastrar cliente"}
                </Button>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Venda sem identificação — o comprovante sai como consumidor final.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
