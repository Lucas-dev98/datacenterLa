"use client";

import { FormEvent, useEffect, useState } from "react";
import { useBulkCadastro } from "@/hooks/use-pim-product-mutations";
import { pimApi } from "@/lib/api/pim";
import { DEFAULT_CATEGORY_ID } from "@/lib/config";
import type { CadastroResult, Category } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

type CategoryAttribute = {
  id: string;
  code: string;
  name: string;
  data_type: string;
  is_required: boolean;
};

function sortCategoryTree(items: Category[]): (Category & { depth: number })[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of items) {
    const key = c.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  const out: (Category & { depth: number })[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

function AttributeField({
  attr,
  value,
  onChange,
  categoryCode,
}: {
  attr: CategoryAttribute;
  value: string;
  onChange: (v: string) => void;
  categoryCode?: string;
}) {
  if (attr.code === "perfil_endurance") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="RI">RI — Read Intensive</option>
        <option value="WI">WI — Write Intensive</option>
        <option value="MU">MU — Mixed Use</option>
      </Select>
    );
  }
  if (attr.code === "interface") {
    const isHdd = categoryCode?.startsWith("HDD_");
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="SATA">SATA</option>
        <option value="SAS">SAS</option>
        {!isHdd ? <option value="NVMe">NVMe</option> : null}
      </Select>
    );
  }
  if (attr.code === "rpm") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="5400">5.400 RPM</option>
        <option value="7200">7.200 RPM</option>
        <option value="10000">10.000 RPM</option>
        <option value="15000">15.000 RPM</option>
      </Select>
    );
  }
  if (attr.code === "tipo_disco") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="Nearline">Nearline</option>
        <option value="Enterprise">Enterprise</option>
        <option value="Performance">Performance</option>
        <option value="Archive">Archive / Cold</option>
      </Select>
    );
  }
  if (attr.code === "velocidade") {
    const isHbaFc = categoryCode === "REDE_HBA_FC";
    const isHbaSas = categoryCode === "REDE_HBA_SAS";
    const isWifi = categoryCode === "REDE_WIFI";
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        {isHbaFc ? (
          <>
            <option value="8G FC">8G FC</option>
            <option value="16G FC">16G FC</option>
            <option value="32G FC">32G FC</option>
            <option value="64G FC">64G FC</option>
          </>
        ) : isHbaSas ? (
          <>
            <option value="6G SAS">6G SAS</option>
            <option value="12G SAS">12G SAS</option>
            <option value="24G SAS">24G SAS</option>
          </>
        ) : isWifi ? (
          <>
            <option value="Wi-Fi 5">Wi-Fi 5 (802.11ac)</option>
            <option value="Wi-Fi 6">Wi-Fi 6 (802.11ax)</option>
            <option value="Wi-Fi 6E">Wi-Fi 6E</option>
            <option value="Wi-Fi 7">Wi-Fi 7</option>
          </>
        ) : (
          <>
            <option value="1G">1G</option>
            <option value="10G">10G</option>
            <option value="25G">25G</option>
            <option value="40G">40G</option>
            <option value="100G">100G</option>
          </>
        )}
      </Select>
    );
  }
  if (attr.code === "tipo_conector") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="RJ45">RJ45</option>
        <option value="SFP">SFP</option>
        <option value="SFP+">SFP+</option>
        <option value="SFP28">SFP28</option>
        <option value="QSFP+">QSFP+</option>
        <option value="QSFP28">QSFP28</option>
        <option value="FC">Fibre Channel (FC)</option>
        <option value="SAS">SAS</option>
      </Select>
    );
  }
  if (attr.code === "portas") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="1">1 porta</option>
        <option value="2">2 portas (Dual)</option>
        <option value="4">4 portas (Quad)</option>
      </Select>
    );
  }
  if (attr.code === "protocolo") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={attr.is_required}>
        <option value="">Selecione…</option>
        <option value="Ethernet">Ethernet</option>
        <option value="Fibre Channel">Fibre Channel</option>
        <option value="SAS">SAS</option>
        <option value="Wi-Fi">Wi-Fi</option>
      </Select>
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={attr.is_required}
    />
  );
}

const CATEGORY_ATTR_DEFAULTS: Record<string, Record<string, string>> = {
  HDD_3_5_SATA: { interface: "SATA", tipo_disco: "Enterprise", rpm: "7200" },
  HDD_3_5_SAS: { interface: "SAS", tipo_disco: "Enterprise", rpm: "7200" },
  HDD_3_5_NL_SAS: { interface: "SAS", tipo_disco: "Nearline", rpm: "7200" },
  HDD_2_5_SATA: { interface: "SATA", tipo_disco: "Enterprise", rpm: "7200" },
  HDD_2_5_SAS: { interface: "SAS", tipo_disco: "Enterprise", rpm: "10000" },
  HDD_2_5_PERF: { interface: "SAS", tipo_disco: "Performance", rpm: "15000" },
  SSD_M2_NVME: { interface: "NVMe" },
  SSD_SATA: { interface: "SATA" },
  SSD_SAS: { interface: "SAS" },
  SSD_U2: { interface: "NVMe" },
  SSD_E1S: { interface: "NVMe" },
  SSD_E3S: { interface: "NVMe" },
  SSD_PCIE_GEN5_AI: { interface: "NVMe" },
  REDE_RJ45_1G: { velocidade: "1G", tipo_conector: "RJ45", portas: "2", protocolo: "Ethernet" },
  REDE_SFP_1G: { velocidade: "1G", tipo_conector: "SFP", portas: "2", protocolo: "Ethernet" },
  REDE_SFP_PLUS: { velocidade: "10G", tipo_conector: "SFP+", portas: "2", protocolo: "Ethernet" },
  REDE_SFP28: { velocidade: "25G", tipo_conector: "SFP28", portas: "2", protocolo: "Ethernet" },
  REDE_QSFP28: { velocidade: "100G", tipo_conector: "QSFP28", portas: "2", protocolo: "Ethernet" },
  REDE_HBA_FC: { velocidade: "32G FC", tipo_conector: "FC", portas: "2", protocolo: "Fibre Channel" },
  REDE_HBA_SAS: { velocidade: "12G SAS", tipo_conector: "SAS", portas: "2", protocolo: "SAS" },
  REDE_WIFI: { velocidade: "Wi-Fi 6", tipo_conector: "RJ45", portas: "1", protocolo: "Wi-Fi" },
};

export default function CadastrosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [nameEs, setNameEs] = useState("");
  const [descriptionEs, setDescriptionEs] = useState("");
  const [generatedEs, setGeneratedEs] = useState("");
  const [publishCp, setPublishCp] = useState(true);
  const [publishEcom, setPublishEcom] = useState(true);
  const { run: bulkCadastro, loading } = useBulkCadastro();
  const [error, setError] = useState("");
  const [result, setResult] = useState<CadastroResult | null>(null);

  const categoryTree = sortCategoryTree(categories.filter((c) => c.is_active));

  useEffect(() => {
    void pimApi.listCategories(true).then((res) => {
      setCategories(res.items);
      if (res.items.length && !res.items.find((c) => c.id === categoryId)) {
        setCategoryId(res.items[0].id);
      }
    });
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId) return;
    const cat = categories.find((c) => c.id === categoryId);
    void pimApi.listCategoryAttributes(categoryId).then((res) => {
      const items = res.items ?? [];
      setAttributes(items);
      const defaults = cat ? CATEGORY_ATTR_DEFAULTS[cat.code] ?? {} : {};
      const values: Record<string, string> = {};
      for (const a of items) {
        if (defaults[a.code]) values[a.id] = defaults[a.code];
      }
      setAttrValues(values);
    });
  }, [categoryId, categories]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    try {
      const body = {
        name,
        category_id: categoryId,
        brand: brand || undefined,
        description: description || undefined,
        name_es: nameEs || undefined,
        description_es: descriptionEs || undefined,
        generated_description_es: generatedEs || undefined,
        publish_compras_paraguai: publishCp,
        publish_ecommerce: publishEcom,
        attributes: attributes.map((a) => ({
          category_attribute_id: a.id,
          value_text: attrValues[a.id] || undefined,
        })).filter((a) => a.value_text),
      };
      const res = await bulkCadastro(body);
      setResult(res);
      setName("");
      setBrand("");
      setDescription("");
      setNameEs("");
      setDescriptionEs("");
      setGeneratedEs("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cadastro");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Novo cadastro</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cria produto + SKU comercial (6 dígitos) + dados de etiqueta. Campos ES obrigatórios para o feed Compras Paraguai.
        </p>
      </header>

      <Card title="Dados do produto">
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Nome (PT)">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categoryTree.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${"  ".repeat(c.depth)}${c.depth > 0 ? "↳ " : ""}${c.name}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marca">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
          <Field label="Descrição (PT)">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {attributes.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">Atributos da categoria</p>
              {attributes.map((a) => (
                <Field key={a.id} label={a.name} hint={a.is_required ? "Obrigatório" : undefined}>
                  <AttributeField
                    attr={a}
                    categoryCode={categories.find((c) => c.id === categoryId)?.code}
                    value={attrValues[a.id] ?? ""}
                    onChange={(v) => setAttrValues((prev) => ({ ...prev, [a.id]: v }))}
                  />
                </Field>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
            <p className="text-sm font-medium text-amber-900">Tradução ES — feed Compras Paraguai</p>
            <Field label="Nome ES" hint="name_es">
              <Input value={nameEs} onChange={(e) => setNameEs(e.target.value)} />
            </Field>
            <Field label="Descrição ES" hint="description_es — obrigatório para publicar no feed">
              <Textarea rows={2} value={descriptionEs} onChange={(e) => setDescriptionEs(e.target.value)} />
            </Field>
            <Field label="Descrição curta ES" hint="generated_description_es — título no feed ES">
              <Input value={generatedEs} onChange={(e) => setGeneratedEs(e.target.value)} />
            </Field>
          </div>

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

          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Criar cadastro"}
          </Button>
        </form>
      </Card>

      {result ? (
        <Alert tone="success">
          Cadastro <strong>{result.sku.code}</strong> criado — {result.product.name}
          <br />
          <span className="text-xs">SKU ID: {result.sku.id}</span>
        </Alert>
      ) : null}
    </div>
  );
}
