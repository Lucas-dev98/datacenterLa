"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  useCreateAndSubmitPurchaseOrder,
  useSaveSupplier,
} from "@/hooks/use-purchase-order-mutations";
import { purchasesApi, type PurchaseOrderSummary, type Supplier } from "@/lib/api/purchases";
import { pimApi } from "@/lib/api/pim";
import { DEFAULT_WAREHOUSE_ID } from "@/lib/config";
import type { SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

type PO = PurchaseOrderSummary;
type Line = { sku_id: string; quantity: number; unit_cost_usd: string; sku_code?: string };

const IMPORT_LABELS: Record<string, string> = {
  local: "Compra local",
  china: "Exportação China → DCL",
  usa: "Exportação EUA → DCL",
  other: "Exportação outro país → DCL",
};

const DESTINATION = "Data Center LA (Paraguai)";

export default function ComprasPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const { run: saveSupplierMutation, loading: savingSupplier } = useSaveSupplier();
  const { run: createAndSubmitPO, loading: submitting } = useCreateAndSubmitPurchaseOrder();
  const [supplierId, setSupplierId] = useState("");
  const [importOrigin, setImportOrigin] = useState("local");
  const [originCountryCode, setOriginCountryCode] = useState("");
  const [intercompanyInvoice, setIntercompanyInvoice] = useState("");
  const [customsRef, setCustomsRef] = useState("");
  const [incoterms, setIncoterms] = useState("FOB");
  const [freightUsd, setFreightUsd] = useState("0");
  const [dutiesUsd, setDutiesUsd] = useState("0");
  const [lines, setLines] = useState<Line[]>([{ sku_id: "", quantity: 1, unit_cost_usd: "0" }]);
  const [supCode, setSupCode] = useState("");
  const [supName, setSupName] = useState("");
  const [supLegalName, setSupLegalName] = useState("");
  const [supCountry, setSupCountry] = useState("CN");
  const [supKind, setSupKind] = useState("intercompany");
  const [supNotes, setSupNotes] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  async function load() {
    try {
      const [s, o, skuRes] = await Promise.all([
        purchasesApi.listSuppliers(),
        purchasesApi.listOrders(),
        pimApi.listAllSkus(),
      ]);
      const list = s.items ?? [];
      setSuppliers(list);
      setOrders(o.items ?? []);
      setSkus(skuRes.items ?? []);
      if (list.length && !supplierId) setSupplierId(list[0].id);
      if (skuRes.items?.length && !lines[0]?.sku_id) {
        setLines([{
          sku_id: skuRes.items[0].id,
          quantity: 1,
          unit_cost_usd: "0",
          sku_code: skuRes.items[0].code,
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    const first = skus[0];
    setLines((prev) => [
      ...prev,
      { sku_id: first?.id ?? "", quantity: 1, unit_cost_usd: "0", sku_code: first?.code },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function resetSupplierForm() {
    setEditingSupplierId(null);
    setSupCode("");
    setSupName("");
    setSupLegalName("");
    setSupCountry("CN");
    setSupKind("intercompany");
    setSupNotes("");
  }

  function startEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setSupCode(s.code);
    setSupName(s.name);
    setSupLegalName(s.legal_name ?? "");
    setSupCountry(s.country);
    setSupKind(s.kind);
    setSupNotes(s.notes ?? "");
    setSupplierId(s.id);
  }

  async function saveSupplier(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body = editingSupplierId
        ? {
            name: supName,
            legal_name: supLegalName.trim() || undefined,
            country: supCountry,
            kind: supKind,
            notes: supNotes.trim() || undefined,
          }
        : {
            code: supCode,
            name: supName,
            legal_name: supLegalName.trim() || undefined,
            country: supCountry,
            kind: supKind,
            notes: supNotes.trim() || undefined,
          };
      const saved = await saveSupplierMutation({ editingId: editingSupplierId, body });
      setInfo(
        editingSupplierId
          ? `Exportador atualizado: ${saved.legal_name ?? saved.name}`
          : `Exportador cadastrado: ${saved.legal_name ?? saved.name}`,
      );
      resetSupplierForm();
      if (!editingSupplierId) setSupplierId(saved.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function createPO(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const items = lines
        .filter((l) => l.sku_id && l.quantity > 0)
        .map((l) => ({
          sku_id: l.sku_id,
          quantity: l.quantity,
          unit_cost_usd: parseFloat(l.unit_cost_usd) || 0,
        }));
      if (!items.length) {
        setError("Adicione ao menos um item");
        return;
      }
      if (!supplierId) {
        setError("Selecione ou cadastre a empresa exportadora");
        return;
      }
      await createAndSubmitPO({
        supplier_id: supplierId,
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        import_origin: importOrigin,
        origin_country_code: importOrigin === "other" ? originCountryCode.trim() || undefined : undefined,
        intercompany_invoice_ref: intercompanyInvoice.trim() || undefined,
        customs_declaration_ref: customsRef.trim() || undefined,
        incoterms: incoterms.trim() || undefined,
        freight_usd: parseFloat(freightUsd) || 0,
        duties_usd: parseFloat(dutiesUsd) || 0,
        items,
      });
      setInfo(`Pedido de compra criado (${items.length} itens) e enviado`);
      setLines([{ sku_id: skus[0]?.id ?? "", quantity: 1, unit_cost_usd: "0", sku_code: skus[0]?.code }]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar PO");
    }
  }

  const isImport = importOrigin !== "local";
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Compras</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cadastre livremente qual empresa exporta para {DESTINATION}. A entrada no Paraguai continua registrada como compra fiscal.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card title={editingSupplierId ? "Editar exportador" : "Cadastrar empresa exportadora"}>
        <p className="mb-4 text-sm text-slate-600">
          Cada razão social no exterior pode ser cadastrada aqui. Use o país ISO e o nome legal da empresa que emite a exportação.
        </p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveSupplier}>
          {!editingSupplierId ? (
            <Field label="Código interno">
              <Input value={supCode} onChange={(e) => setSupCode(e.target.value)} placeholder="ex. EXP-SHENZHEN-01" required />
            </Field>
          ) : (
            <Field label="Código interno">
              <Input value={supCode} disabled />
            </Field>
          )}
          <Field label="Nome comercial">
            <Input value={supName} onChange={(e) => setSupName(e.target.value)} required />
          </Field>
          <Field label="Razão social / legal name">
            <Input value={supLegalName} onChange={(e) => setSupLegalName(e.target.value)} placeholder="nome completo para documentos fiscais" />
          </Field>
          <Field label="País do exportador (ISO)">
            <Input value={supCountry} onChange={(e) => setSupCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="CN, US, HK…" required />
          </Field>
          <Field label="Classificação">
            <Select value={supKind} onChange={(e) => setSupKind(e.target.value)}>
              <option value="intercompany">Grupo / relacionada</option>
              <option value="external">Terceiro</option>
            </Select>
          </Field>
          <Field label="Observações">
            <Input value={supNotes} onChange={(e) => setSupNotes(e.target.value)} placeholder="opcional" />
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={savingSupplier}>
              {savingSupplier
                ? "Salvando…"
                : editingSupplierId
                  ? "Salvar alterações"
                  : "Salvar exportador"}
            </Button>
            {editingSupplierId ? (
              <Button type="button" variant="secondary" onClick={resetSupplierForm}>Cancelar edição</Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="Exportadores cadastrados">
        <Table
          headers={["Código", "Razão social", "País", "Tipo", ""]}
          rows={suppliers.map((s) => [
            s.code,
            s.legal_name ?? s.name,
            s.country,
            s.kind === "intercompany" ? "Grupo" : "Terceiro",
            <span key={s.id} className="flex gap-2">
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setSupplierId(s.id)}>
                Usar na PO
              </button>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => startEditSupplier(s)}>
                Editar
              </button>
            </span>,
          ])}
        />
      </Card>

      <Card title="Nova ordem de compra (entrada fiscal)">
        <form className="space-y-4" onSubmit={createPO}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rota fiscal de importação">
              <Select value={importOrigin} onChange={(e) => setImportOrigin(e.target.value)}>
                <option value="local">Compra local (Paraguai)</option>
                <option value="china">Rota China → {DESTINATION}</option>
                <option value="usa">Rota EUA → {DESTINATION}</option>
                <option value="other">Outro país → {DESTINATION}</option>
              </Select>
            </Field>
            {importOrigin === "other" ? (
              <Field label="País de origem (ISO)">
                <Input
                  value={originCountryCode}
                  onChange={(e) => setOriginCountryCode(e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="HK, TW, DE…"
                  required
                />
              </Field>
            ) : null}
            <Field label="Empresa exportadora">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="">— selecione —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.legal_name ?? s.name} ({s.country})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selectedSupplier && isImport ? (
            <p className="text-sm text-slate-600">
              Exportador: <strong>{selectedSupplier.legal_name ?? selectedSupplier.name}</strong> ({selectedSupplier.country})
              → destino <strong>{DESTINATION}</strong>
            </p>
          ) : null}

          {isImport ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
              <p className="text-sm font-medium text-blue-900">Documentos da exportação / importação</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Invoice de exportação">
                  <Input value={intercompanyInvoice} onChange={(e) => setIntercompanyInvoice(e.target.value)} placeholder="nº invoice do exportador" />
                </Field>
                <Field label="Declaração aduaneira (DUA/DI)">
                  <Input value={customsRef} onChange={(e) => setCustomsRef(e.target.value)} placeholder="referência despacho" />
                </Field>
                <Field label="Incoterms">
                  <Select value={incoterms} onChange={(e) => setIncoterms(e.target.value)}>
                    <option value="FOB">FOB</option>
                    <option value="CIF">CIF</option>
                    <option value="EXW">EXW</option>
                    <option value="DDP">DDP</option>
                  </Select>
                </Field>
                <Field label="Frete USD">
                  <Input value={freightUsd} onChange={(e) => setFreightUsd(e.target.value)} />
                </Field>
                <Field label="Impostos / direitos USD">
                  <Input value={dutiesUsd} onChange={(e) => setDutiesUsd(e.target.value)} />
                </Field>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Itens</p>
            <div className="hidden sm:grid sm:grid-cols-[1fr_80px_120px_auto] gap-2 text-xs font-medium text-slate-500 px-1">
              <span>SKU</span>
              <span>Qtd</span>
              <span>Custo USD</span>
              <span />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_120px_auto] items-end">
                <Select
                  value={line.sku_id}
                  onChange={(e) => {
                    const sku = skus.find((s) => s.id === e.target.value);
                    updateLine(i, { sku_id: e.target.value, sku_code: sku?.code });
                  }}
                  required
                >
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 1 })}
                  required
                />
                <Input
                  value={line.unit_cost_usd}
                  onChange={(e) => updateLine(i, { unit_cost_usd: e.target.value })}
                  required
                />
                <Button type="button" variant="secondary" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                  Remover
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addLine}>+ Item</Button>
          </div>

          <Button type="submit" disabled={submitting || !supplierId}>
            {submitting ? "Criando…" : isImport ? "Registrar importação e enviar PO" : "Criar e enviar PO"}
          </Button>
        </form>
      </Card>

      <Card title="Pedidos de compra">
        <Table
          headers={["PO", "Rota", "Exportador", "Status", "Data", ""]}
          rows={orders.map((o) => [
            o.po_number,
            IMPORT_LABELS[o.import_origin ?? "local"] ?? o.import_origin ?? "Local",
            o.supplier_name ?? "—",
            o.status,
            new Date(o.created_at).toLocaleDateString("pt-BR"),
            <span key="l" className="flex flex-col gap-1">
              <Link href={`/compras/${o.id}`} className="text-blue-600 hover:underline">
                Abrir
              </Link>
              {o.status === "ordered" || o.status === "partial" ? (
                <Link
                  href={`/estoque/entrada/compras/${o.id}/receber`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Receber mercadoria
                </Link>
              ) : null}
            </span>,
          ])}
        />
      </Card>
    </div>
  );
}
