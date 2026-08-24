# Modelo de Identificação — Cadastro, SKU e Unidade

Decisão fechada para PIM, Estoque e integrações.

---

## Hierarquia

```
CADASTRO                         UNIDADE (peça no estoque)
     │                                    │
  SKU: 000042                       AAA0001
  + QR Code                         AAA0002
  + descrição gerada                AAA0003
```

| Nível | Código | Quando gera |
|-------|--------|-------------|
| **Cadastro** | SKU `000042` (6 dígitos) | Ao criar o cadastro |
| **Unidade** | `AAA0001`, `AAA0002`… | Ao registrar cada peça no estoque |

---

## Etiqueta do CADASTRO (produto)

Impressa no cadastro comercial — identifica o **SKU**, não a peça individual:

```
MEMORIA DDR4 32GB 3200MHZ ECC RDIMM SAMSUNG
SKU: 000042
[QR CODE]
```

- **Linha 1:** descrição gerada pelo PIM (atributos + categoria + marca)
- **Linha 2:** SKU numérico de 6 dígitos
- **QR Code:** aponta para o cadastro/SKU (consulta, catálogo, link interno)

---

## Etiqueta da UNIDADE (peça no estoque)

Cada peça recebe código **sequencial** ao entrar no estoque:

```
AAA0001
MEMORIA DDR4 32GB 3200MHZ ECC RDIMM SAMSUNG
SKU: 000042
[QR CODE / Código de barras]
```

| Campo | Formato | Exemplo |
|-------|---------|---------|
| `inventory_units.public_code` | `AAA` + sequência (mín. 4 dígitos) | `AAA0001`, `AAA0002`, `AAA10000` |

**Regras:**

- Gerado na **entrada no estoque** (`generate_unit_public_code()`)
- Uma peça = um código — **imutável**
- Vinculado ao cadastro via `sku_id`
- Usado em: scanner, inventário, rastreamento, garantia, RMA

---

## Exemplo completo

**Cadastro** SKU `000042`:

```
Descrição: MEMORIA DDR4 32GB 3200MHZ ECC RDIMM SAMSUNG
Categoria: Memória
Atributos: capacidade=32GB, tecnologia=DDR4, ecc=Sim, marca=Samsung
```

**Unidades desse cadastro:**

```
AAA0001  →  SKU 000042  →  Disponível
AAA0002  →  SKU 000042  →  Vendida
AAA0003  →  SKU 000042  →  Disponível
```

---

## Relação com módulos

| Módulo | Código |
|--------|--------|
| PIM / Cadastro | SKU `000042` + descrição gerada |
| Estoque | `AAA0001` por peça |
| Vendas / Cotações | SKU |
| Compras Paraguai (feed) | SKU no `<codigo>` |
| Garantia / RMA | `AAA0001` da peça |

---

## Schema

```sql
skus.code                   -- CHAR(6)  → 000042
inventory_units.public_code -- VARCHAR  → AAA0001
```

Migrations: `004_identifiers.up.sql`, `005_unit_aaa_codes.up.sql`

---

## API

| Busca | Endpoint |
|-------|----------|
| Cadastro por SKU | `GET /api/v1/pim/skus/code/000042` |
| Etiqueta cadastro | `GET /api/v1/pim/skus/code/000042/label` |
| Criar cadastro (produto + SKU) | `POST /api/v1/pim/cadastros` |
| Unidade por código | `GET /api/v1/stock/units/code/AAA0001` |
| Etiqueta unidade | `GET /api/v1/stock/units/code/AAA0001/label` |
| **Feed Compras Paraguai** | `GET /api/v1/integrations/compras-paraguai/feed.xml` |
| Meta do feed (skipped) | `GET /api/v1/integrations/compras-paraguai/feed` |

Resposta de `/label`: JSON com `description`, `sku` ou `unit_code`, `qr_content` e `lines` (texto para impressão).

**QR Code (imagem):**

| Formato | Exemplo |
|---------|---------|
| PNG | `GET .../label?format=png` (opcional `&size=256`, 64–1024) |
| SVG | `GET .../label?format=svg` |
| HTML (impressão térmica) | `GET .../label?format=html` |
| PDF (impressão térmica) | `GET .../label?format=pdf` |
| PNG em base64 no JSON | `GET .../label?include_qr=true` → campo `qr_image_png_base64` |

Tamanho padrão da etiqueta (58 mm largura — impressora térmica comum):

| Tipo | Padrão | Query params |
|------|--------|--------------|
| Cadastro | 58 × 35 mm | `&width_mm=58&height_mm=35` |
| Unidade | 58 × 45 mm | `&width_mm=58&height_mm=45` |

Implementação: [`backend/README.md`](../../backend/README.md)
