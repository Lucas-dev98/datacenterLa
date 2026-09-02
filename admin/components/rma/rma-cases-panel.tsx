"use client";

import type { RMACase } from "@/lib/api/rma";
import { defaultRmaResolution, rmaResolutionOptions } from "@/lib/rma-resolution";
import { rmaStatusLabel } from "@/lib/status-labels";
import { Card, Field, Input, Select, Table } from "@/components/ui";
import { RMATestPhotoThumb } from "@/components/rma/rma-test-photo-thumb";

type Props = {
  caseSearch: string;
  onCaseSearchChange: (value: string) => void;
  items: RMACase[];
  expandedCaseId: string;
  onToggleCase: (id: string) => void;
  expandedCase: RMACase | null;
  resolveById: Record<string, string>;
  onResolveChange: (caseId: string, resolution: string) => void;
  onAction: (id: string, step: "approve" | "receive" | "resolve", resolution?: string) => void;
};

export function RMACasesPanel({
  caseSearch,
  onCaseSearchChange,
  items,
  expandedCaseId,
  onToggleCase,
  expandedCase,
  resolveById,
  onResolveChange,
  onAction,
}: Props) {
  return (
    <Card title="Casos RMA">
      <div className="mb-4">
        <Field label="Buscar casos" hint="Cliente, documento, pedido, código AAA ou número do caso (RMA-…)">
          <Input
            value={caseSearch}
            onChange={(e) => onCaseSearchChange(e.target.value)}
            placeholder="Ex.: RMA-000002, PED-001020, AAA0142"
          />
        </Field>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          {caseSearch.trim() ? "Nenhum caso encontrado para essa busca." : "Nenhum caso."}
        </p>
      ) : (
        <Table
          headers={["Caso", "Pedido", "Cliente", "Status", "Garantia", "Motivo", ""]}
          rows={items.map((r) => [
            <button
              key={`case-${r.id}`}
              type="button"
              className="font-mono text-blue-600 hover:underline"
              onClick={() => onToggleCase(r.id)}
            >
              {r.case_number}
            </button>,
            r.order_number ?? "—",
            r.customer_name ?? "—",
            rmaStatusLabel(r.status),
            r.within_warranty ? (
              <span className="text-emerald-700">Dentro do prazo</span>
            ) : (
              <span className="text-red-700">Expirada</span>
            ),
            r.reason,
            <div key="a" className="flex flex-wrap gap-2">
              {r.status === "inspecting" || r.status === "requested" ? (
                <button
                  type="button"
                  className="text-blue-600 hover:underline disabled:text-slate-400"
                  disabled={!r.within_warranty}
                  title={r.within_warranty ? "Aprovar RMA" : "Fora do prazo de garantia"}
                  onClick={() => onAction(r.id, "approve")}
                >
                  Aprovar
                </button>
              ) : null}
              {r.status === "approved" ? (
                <button type="button" className="text-blue-600 hover:underline" onClick={() => onAction(r.id, "receive")}>
                  Receber
                </button>
              ) : null}
              {r.status === "received" ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Select
                    value={resolveById[r.id] ?? defaultRmaResolution(r)}
                    onChange={(e) => onResolveChange(r.id, e.target.value)}
                  >
                    {rmaResolutionOptions(r).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => onAction(r.id, "resolve", resolveById[r.id] ?? defaultRmaResolution(r))}
                  >
                    Resolver
                  </button>
                </span>
              ) : null}
            </div>,
          ])}
        />
      )}

      {expandedCase ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-3 text-sm">
            <p>
              <strong>Teste:</strong> {expandedCase.test_notes ?? "—"}
            </p>
            {expandedCase.defect_confirmed ? (
              <p className="text-amber-800">Defeito confirmado — resolução esperada: descarte</p>
            ) : null}
            {expandedCase.resolution ? (
              <p>
                <strong>Resolução:</strong> {expandedCase.resolution}
              </p>
            ) : null}
            {(expandedCase.test_photos ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(expandedCase.test_photos ?? []).map((photo, index) => (
                  <RMATestPhotoThumb
                    key={photo.id}
                    caseId={expandedCase.id}
                    photoId={photo.id}
                    alt={`Evidência ${index + 1}`}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-500">Sem fotos de evidência.</p>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
