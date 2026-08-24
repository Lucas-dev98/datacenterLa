"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Customer, SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

type Line = { sku_id: string; quantity: number; sku_code?: string };

export default function NovaCotacaoPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("b2b");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ sku_id: "", quantity: 1 }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<{ items: Customer[] }>("/api/v1/sales/customers?active_only=true"),
      api<{ items: SKU[] }>("/api/v1/pim/skus?active_only=true&limit=100"),
    ]).then(([c, s]) => {
      setCustomers(c.items);
      setSkus(s.items);
      if (c.items.length) setCustomerId(c.items[0].id);
      if (s.items.length) setLines([{ sku_id: s.items[0].id, quantity: 1, sku_code: s.items[0].code }]);
    });
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { sku_id: skus[0]?.id ?? "", quantity: 1 }]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const quote = await api<{ id: string }>("/api/v1/sales/quotes", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          channel,
          discount_pct: parseFloat(discount) || 0,
          notes: notes || undefined,
          items: lines
            .filter((l) => l.sku_id && l.quantity > 0)
            .map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
        }),
      });
      router.push(`/cotacoes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cotação");
    } finally {
      setLoading(false);
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
              </Select>
            </Field>
            <Field label="Desconto %">
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
          </div>
          <Field label="Observações">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Itens</p>
            {lines.map((line, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <Select
                  value={line.sku_id}
                  onChange={(e) => {
                    const sku = skus.find((s) => s.id === e.target.value);
                    updateLine(i, { sku_id: e.target.value, sku_code: sku?.code });
                  }}
                >
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addLine}>
              + Item
            </Button>
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" disabled={loading || !customerId}>
            {loading ? "Criando…" : "Criar cotação"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
