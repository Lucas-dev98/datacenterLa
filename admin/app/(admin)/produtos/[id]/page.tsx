"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { CategoryAttribute, Product, ProductAttributeValue, SKU } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";

function attrValue(attrs: ProductAttributeValue[], attrId: string): string {
  const a = attrs.find((x) => x.category_attribute_id === attrId);
  if (!a) return "";
  if (a.value_text) return a.value_text;
  if (a.value_number != null) return String(a.value_number);
  if (a.value_boolean != null) return a.value_boolean ? "true" : "false";
  return "";
}

export default function ProdutoEditPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [sku, setSku] = useState<SKU | null>(null);
  const [catAttrs, setCatAttrs] = useState<CategoryAttribute[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [nameEs, setNameEs] = useState("");
  const [descriptionEs, setDescriptionEs] = useState("");
  const [generatedEs, setGeneratedEs] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [publishCp, setPublishCp] = useState(false);
  const [publishEcom, setPublishEcom] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const p = await api<Product & { skus?: SKU[] }>(`/api/v1/pim/products/${params.id}`);
        setProduct(p);
        setName(p.name);
        setBrand(p.brand ?? "");
        setDescription(p.description ?? "");
        setNameEs(p.name_es ?? "");
        setDescriptionEs(p.description_es ?? "");
        setGeneratedEs(p.generated_description_es ?? "");
        const firstSku = p.skus?.[0] ?? null;
        setSku(firstSku);
        if (firstSku) {
          setPublishCp(firstSku.publish_compras_paraguai);
          setPublishEcom(firstSku.publish_ecommerce);
          setImageUrl(firstSku.image_url ?? "");
        }
        const values: Record<string, string> = {};
        for (const a of p.attributes ?? []) {
          values[a.category_attribute_id] = attrValue(p.attributes ?? [], a.category_attribute_id);
        }
        setAttrValues(values);
        if (p.category_id) {
          const res = await api<{ items: CategoryAttribute[] }>(`/api/v1/pim/categories/${p.category_id}/attributes`);
          setCatAttrs(res.items ?? []);
          for (const def of res.items ?? []) {
            if (!(def.id in values)) values[def.id] = "";
          }
          setAttrValues({ ...values });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const attributes = catAttrs.map((def) => {
        const raw = attrValues[def.id] ?? "";
        const base = { category_attribute_id: def.id };
        if (def.data_type === "number") {
          const n = parseFloat(raw);
          return { ...base, value_number: Number.isFinite(n) ? n : undefined };
        }
        if (def.data_type === "boolean") {
          return { ...base, value_boolean: raw === "true" || raw === "1" };
        }
        return { ...base, value_text: raw || undefined };
      }).filter((a) => "value_text" in a && a.value_text || "value_number" in a && a.value_number != null || "value_boolean" in a);

      await api(`/api/v1/pim/products/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          brand: brand || undefined,
          description: description || undefined,
          name_es: nameEs || undefined,
          description_es: descriptionEs || undefined,
          generated_description_es: generatedEs || undefined,
          attributes,
        }),
      });
      if (sku) {
        await api(`/api/v1/pim/skus/${sku.id}`, {
          method: "PUT",
          body: JSON.stringify({
            publish_compras_paraguai: publishCp,
            publish_ecommerce: publishEcom,
            image_url: imageUrl || undefined,
          }),
        });
      }
      setInfo("Produto atualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/produtos" className="text-sm text-blue-600 hover:underline">← Produtos</Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Editar produto</h1>
        {sku ? <p className="mt-1 font-mono text-sm text-slate-600">SKU {sku.code}</p> : null}
      </header>

      <Card title="Dados gerais">
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Nome (PT)">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Marca">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
          <Field label="Descrição (PT)">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {catAttrs.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">Atributos da categoria</p>
              {catAttrs.map((def) => (
                <Field key={def.id} label={def.name} hint={def.is_required ? "Obrigatório" : def.data_type}>
                  {def.data_type === "boolean" ? (
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={attrValues[def.id] ?? ""}
                      onChange={(e) => setAttrValues((p) => ({ ...p, [def.id]: e.target.value }))}
                    >
                      <option value="">—</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  ) : (
                    <Input
                      type={def.data_type === "number" ? "number" : "text"}
                      value={attrValues[def.id] ?? ""}
                      onChange={(e) => setAttrValues((p) => ({ ...p, [def.id]: e.target.value }))}
                      required={def.is_required}
                    />
                  )}
                </Field>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
            <p className="text-sm font-medium text-amber-900">Tradução ES — feed Compras Paraguai</p>
            <Field label="Nome ES"><Input value={nameEs} onChange={(e) => setNameEs(e.target.value)} /></Field>
            <Field label="Descrição ES"><Textarea rows={2} value={descriptionEs} onChange={(e) => setDescriptionEs(e.target.value)} /></Field>
            <Field label="Descrição curta ES"><Input value={generatedEs} onChange={(e) => setGeneratedEs(e.target.value)} /></Field>
          </div>

          {sku ? (
            <>
              <Field label="URL da imagem (e-commerce)">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </Field>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={publishCp} onChange={(e) => setPublishCp(e.target.checked)} />
                  Publicar Compras Paraguai
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={publishEcom} onChange={(e) => setPublishEcom(e.target.checked)} />
                  Publicar e-commerce
                </label>
              </div>
            </>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}
          {info ? <Alert tone="success">{info}</Alert> : null}
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
        </form>
      </Card>

      {product?.generated_description ? (
        <Card title="Descrição gerada (PT)">
          <p className="text-sm text-slate-700">{product.generated_description}</p>
        </Card>
      ) : null}
    </div>
  );
}
