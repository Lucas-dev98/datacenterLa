"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomersList } from "@/hooks/use-customers-list";
import { useSkusList } from "@/hooks/use-pim-list-queries";
import { useCreateQuote } from "@/hooks/use-quote-mutations";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

type Line = { sku_id: string; quantity: number; sku_code?: string };

export default function NovaCotacaoPage() {
  const router = useRouter();
  const { data: customersData } = useCustomersList();
  const { data: skusData } = useSkusList();
  const customers = customersData?.items ?? [];
  const skus = skusData ?? [];
  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("b2b");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ sku_id: "", quantity: 1 }]);
  const [error, setError] = useState("");
  const { run: createQuote, loading } = useCreateQuote();

  useEffect(() => {
    if (!customersData && !skusData) return;
    if (customers.length && !customerId) setCustomerId(customers[0].id);
    if (skus.length) {
      setLines((prev) => {
        if (prev[0]?.sku_id) return prev;
        return [{ sku_id: skus[0].id, quantity: 1, sku_code: skus[0].code }];
      });
    }
  }, [customersData, skusData, customers, skus, customerId]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { sku_id: skus[0]?.id ?? "", quantity: 1 }]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const quote = await createQuote({
        customer_id: customerId,
        channel,
        discount_pct: parseFloat(discount) || 0,
        notes: notes || undefined,
        items: lines
          .filter((l) => l.sku_id && l.quantity > 0)
          .map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
      });
      router.push(`/cotacoes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cotação");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Nova cotação</h1>
      </header>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Cliente">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Canal">
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="b2b">B2B</option>
                <option value="b2c">B2C</option>
                <option value="reseller">Revendedor</option>
              </Select>
            </Field>
            <Field label="Desconto (%)">
              <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
          </div>
          <Field label="Observações">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Itens</p>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-3">
                <Field label="SKU">
                  <Select
                    value={line.sku_id}
                    onChange={(e) => {
                      const sku = skus.find((s) => s.id === e.target.value);
                      updateLine(index, { sku_id: e.target.value, sku_code: sku?.code });
                    }}
                  >
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Qtd">
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                  />
                </Field>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addLine}>
              + Linha
            </Button>
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Criando…" : "Criar cotação"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
