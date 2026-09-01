"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useFinanceDashboard } from "@/hooks/use-finance-dashboard";
import { financeApi, type Payable } from "@/lib/api/finance";
import type { ReceivableListItem } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Table } from "@/components/ui";

export default function FinanceiroPage() {
  const [status, setStatus] = useState("open");
  const { data, error, loading, refetch } = useFinanceDashboard(status);
  const items = data?.receivables ?? [];
  const payables = data?.payables ?? [];
  const summary = data?.summary ?? null;
  const margins = data?.margins ?? [];
  const total = data?.receivablesTotal ?? 0;
  const [info, setInfo] = useState("");
  const [payingReceivableId, setPayingReceivableId] = useState<string | null>(null);
  const [payingPayableId, setPayingPayableId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("transfer");
  const [payRef, setPayRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const displayError = actionError || error;

  const outstanding = items.reduce((sum, r) => sum + (r.amount_usd - r.paid_usd), 0);

  function openReceivablePayment(r: ReceivableListItem) {
    setPayingPayableId(null);
    setPayingReceivableId(r.id);
    setPayAmount((r.amount_usd - r.paid_usd).toFixed(2));
    setPayMethod("transfer");
    setPayRef("");
  }

  function openPayablePayment(p: Payable) {
    setPayingReceivableId(null);
    setPayingPayableId(p.id);
    setPayAmount((p.amount_usd - p.amount_paid_usd).toFixed(2));
    setPayMethod("transfer");
    setPayRef("");
  }

  async function submitReceivablePayment(e: FormEvent) {
    e.preventDefault();
    if (!payingReceivableId) return;
    setSubmitting(true);
    setActionError("");
    setInfo("");
    try {
      await financeApi.recordReceivablePayment(payingReceivableId, {
        amount_usd: parseFloat(payAmount) || 0,
        method: payMethod,
        reference: payRef || undefined,
      });
      setPayingReceivableId(null);
      setInfo("Pagamento registrado no título a receber");
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayablePayment(e: FormEvent) {
    e.preventDefault();
    if (!payingPayableId) return;
    setSubmitting(true);
    setActionError("");
    setInfo("");
    try {
      await financeApi.payPayable(payingPayableId, {
        amount_usd: parseFloat(payAmount) || 0,
        method: payMethod,
        reference: payRef || undefined,
      });
      setPayingPayableId(null);
      setInfo("Pagamento registrado na conta a pagar");
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  async function exportMargins() {
    setActionError("");
    try {
      const blob = await financeApi.exportMargins();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "margens-pedidos.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao exportar");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-600">
          Contas a receber · {total} título(s) nesta lista
          {summary ? ` · AR total: USD ${summary.receivables_open_usd.toFixed(2)}` : ""}
          {summary ? ` · AP total: USD ${summary.payables_open_usd.toFixed(2)}` : ""}
        </p>
        <Link href="/financeiro/analytics" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          KPIs e Curva ABC →
        </Link>
      </header>

      {info ? <Alert tone="success">{info}</Alert> : null}
      {displayError ? <Alert tone="error">{displayError}</Alert> : null}

      {summary ? (
        <Card title="Resumo — margem bruta">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-slate-500">Receita (expedida)</p>
              <p className="text-lg font-semibold">${summary.revenue_usd.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Custo (landed/un.)</p>
              <p className="text-lg font-semibold">${summary.cogs_usd.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Margem bruta</p>
              <p className="text-lg font-semibold text-emerald-700">
                ${summary.gross_margin_usd.toFixed(2)} ({summary.gross_margin_pct.toFixed(1)}%)
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">A receber / a pagar</p>
              <p className="text-sm">
                AR ${summary.receivables_open_usd.toFixed(2)} · AP ${summary.payables_open_usd.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">
                {summary.import_po_open_count} PO(s) import. em aberto
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {margins.length > 0 ? (
        <Card title="Margem por pedido">
          <div className="mb-3 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => void exportMargins()}>
              Exportar CSV
            </Button>
          </div>
          <Table
            headers={["Pedido", "Cliente", "Canal", "Receita", "Custo", "Margem", "Status"]}
            rows={margins.map((m) => [
              <Link key="o" href={`/pedidos/${m.order_id}`} className="font-mono text-sm text-blue-600 hover:underline">
                {m.order_number}
              </Link>,
              m.customer_name,
              m.channel,
              `$${m.revenue_usd.toFixed(2)}`,
              `$${m.cogs_usd.toFixed(2)}`,
              `$${m.margin_usd.toFixed(2)} (${m.margin_pct.toFixed(0)}%)`,
              m.status,
            ])}
          />
        </Card>
      ) : null}

      <Card title="Contas a pagar (compras / importação)">
        {payables.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma conta a pagar. Gerada ao concluir recebimento de PO.</p>
        ) : (
          <Table
            headers={["PO", "Exportador", "Vencimento", "Valor", "Pago", "Saldo", "Status", ""]}
            rows={payables.map((p) => {
              const balance = p.amount_usd - p.amount_paid_usd;
              const canPay = balance > 0 && p.status !== "paid";
              return [
                p.po_number ? (
                  <Link key="po" href={`/compras/${p.purchase_order_id}`} className="font-mono text-sm text-blue-600 hover:underline">
                    {p.po_number}
                  </Link>
                ) : "—",
                p.supplier_name ?? "—",
                p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—",
                `$${p.amount_usd.toFixed(2)}`,
                `$${p.amount_paid_usd.toFixed(2)}`,
                `$${balance.toFixed(2)}`,
                p.status,
                canPay ? (
                  <button key="pay" type="button" className="text-blue-600 hover:underline" onClick={() => openPayablePayment(p)}>
                    Pagar
                  </button>
                ) : "—",
              ];
            })}
          />
        )}
      </Card>

      {payingPayableId ? (
        <Card title="Registrar pagamento — conta a pagar">
          <form onSubmit={(e) => void submitPayablePayment(e)} className="max-w-md space-y-4">
            <Field label="Valor (USD)">
              <Input type="number" step="0.01" min="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Confirmar pagamento"}</Button>
              <Button type="button" variant="secondary" onClick={() => setPayingPayableId(null)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title="Filtros — contas a receber">
        <Select className="max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="open">Em aberto</option>
          <option value="partial">Parcial</option>
          <option value="paid">Quitado</option>
          <option value="cancelled">Cancelado</option>
        </Select>
      </Card>

      <Card title="Contas a receber">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum título encontrado.</p>
        ) : (
          <Table
            headers={["Pedido", "Cliente", "Vencimento", "Valor", "Pago", "Saldo", "Status", ""]}
            rows={items.map((r) => {
              const balance = r.amount_usd - r.paid_usd;
              const canPay = balance > 0 && r.status !== "cancelled";
              return [
                <span key="o" className="font-mono text-sm">{r.order_number}</span>,
                r.customer_name,
                r.due_date,
                `$${r.amount_usd.toFixed(2)}`,
                `$${r.paid_usd.toFixed(2)}`,
                `$${balance.toFixed(2)}`,
                r.status,
                <div key="a" className="flex gap-2">
                  <Link href={`/pedidos/${r.order_id}`} className="text-blue-600 hover:underline">Pedido</Link>
                  {canPay ? (
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => openReceivablePayment(r)}>
                      Baixar
                    </button>
                  ) : null}
                </div>,
              ];
            })}
          />
        )}
        {items.length ? (
          <p className="mt-3 text-xs text-slate-500">Pendente na página: USD {outstanding.toFixed(2)}</p>
        ) : null}
      </Card>

      {payingReceivableId ? (
        <Card title="Registrar pagamento — conta a receber">
          <form onSubmit={(e) => void submitReceivablePayment(e)} className="max-w-md space-y-4">
            <Field label="Valor (USD)">
              <Input type="number" step="0.01" min="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </Field>
            <Field label="Método">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="transfer">Transferência</option>
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão</option>
                <option value="check">Cheque</option>
              </Select>
            </Field>
            <Field label="Referência">
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Opcional" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Confirmar baixa"}</Button>
              <Button type="button" variant="secondary" onClick={() => setPayingReceivableId(null)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
