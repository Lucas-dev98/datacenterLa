# Integração — Compras Paraguai

## Princípio

O **ERP é proprietário dos dados**. O Compras Paraguai é consumidor/publicador desses dados — nunca o contrário.

```
BASE DE PRODUTOS DATA CENTER LA
              ↓
      CAMADA DE MAPEAMENTO
              ↓
         VALIDAÇÃO
              ↓
      GERADOR DE FEED
              ↓
     XML COMPRAS PARAGUAI
```

## Fluxo de sincronização

```
ERP: Produto atualizado
  ↓
Evento de atualização
  ↓
Integração identifica alteração
  ↓
Feed/XML atualizado
```

## Fonte única de estoque

```
               ESTOQUE CENTRAL
                      │
         ┌────────────┼────────────┐
         │            │            │
      ERP/Vendas  E-commerce  Compras Paraguai
```

Os canais externos recebem informações **derivadas** da fonte central. Não existe estoque separado do site ou do Compras Paraguai.

## Campos do feed XML

Referência: [feed-compras-paraguai.xml](./feed-compras-paraguai.xml)

### Obrigatórios

| Campo | Descrição | Regras |
|-------|-----------|--------|
| `title` | Nome do produto em português (BR) | UTF-8, sem tags HTML para acentuação |
| `description` | Descrição em português (BR) | UTF-8, sem tags HTML |
| `title_es` | Nome do produto em espanhol | UTF-8, sem tags HTML |
| `description_es` | Descrição em espanhol | UTF-8, sem tags HTML |
| `codigo` | Código do cadastro comercial (SKU) | Mapeado de `skus.code` |
| `preco` | Preço em USD | Formato: `199.50 USD` |
| `price_iva` | Preço com IVA (venda a paraguaios) | Opcional; se omitido, exibe `<preco>` no domínio paraguaio |
| `estoque` | Quantidade disponível | Derivado do estoque central (disponível, não físico bruto) |
| `link` | URL da página do produto | Gerado pelo e-commerce ou landing page |
| `link_imagem` | URL da imagem | Deixar vazio se não houver imagem — **não** usar placeholder |

### Opcionais

| Campo | Descrição | Valores |
|-------|-----------|---------|
| `disponibilidade` | Status de disponibilidade | `em estoque` ou `fora de estoque` |
| `link_comprar` | URL de checkout/compra direta | |
| `preco_normal_sem_liquidacao` | Preço original (liquidação) | Apenas lojas autorizadas |
| `marca` | Marca do produto | Derivado do PIM |
| `tipo_venda` | Canal de venda | `apenas loja`, `apenas internet`, `loja+internet` |

## Camada de mapeamento (ERP → Feed)

O cadastro interno **não é limitado pelo XML**. A camada de mapeamento traduz:

| Origem (ERP/PIM) | Destino (Feed) |
|------------------|----------------|
| `products.hex_code` | Referência interna (não enviado no feed) |
| Nome gerado por regras de categoria | `title` |
| Descrição gerada / traduzida | `description`, `description_es`, `title_es` |
| `skus.code` (cadastro comercial) | `codigo` |
| Preço B2C USD | `preco` |
| Preço com IVA calculado | `price_iva` |
| Estoque disponível (SKU) | `estoque`, `disponibilidade` |
| URL do produto no e-commerce | `link`, `link_comprar` |
| Imagem principal | `link_imagem` |
| Marca | `marca` |
| Configuração de canal | `tipo_venda` |

## Validações antes de publicar

- Todos os campos obrigatórios preenchidos
- `estoque` >= 0
- `preco` e `price_iva` em formato válido
- `link_imagem` vazio se produto sem imagem (nunca placeholder)
- Textos em UTF-8 sem HTML embutido
- Produto ativo no ERP e elegível para publicação no canal

## Eventos que disparam atualização do feed

- Alteração de preço
- Alteração de estoque disponível
- Alteração de título/descrição
- Ativação/desativação de produto
- Alteração de imagem
- Alteração de IVA ou regra fiscal aplicável

## Resiliência

- Se Compras Paraguai ficar indisponível: e-commerce e ERP continuam operando normalmente
- Feed gerado localmente, cacheado em `feed_cache` e entregue via fila (`feed_delivery_jobs`) com retentativa (1m, 5m, 15m)
- Log de cada sincronização em `feed_sync_logs` + entradas por SKU em `feed_sync_log_entries`
- Worker agendado (`FEED_SYNC_INTERVAL`, padrão 15 min) + sync manual via API

## Tradução ES (PIM)

Campos em `products`:

| Campo | Uso no feed |
|-------|-------------|
| `generated_description_es` | Preferência para `title_es` |
| `name_es` | Fallback de `title_es` |
| `description_es` | `description_es` (obrigatório) |

SKUs sem tradução ES completa são **omitidos** do feed e registrados no log com motivo `tradução ES incompleta`.

## API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/v1/integrations/compras-paraguai/feed.xml` | Não | XML cacheado |
| GET | `/api/v1/integrations/compras-paraguai/feed` | Não | Metadados do cache |
| GET | `/api/v1/integrations/compras-paraguai/sync/logs` | JWT + `pim.products.read` | Histórico de sync |
| GET | `/api/v1/integrations/compras-paraguai/sync/logs/{id}` | JWT + `pim.products.read` | Detalhe com entradas |
| POST | `/api/v1/integrations/compras-paraguai/sync/run` | JWT + `pim.products.write` | Sync manual |

## Configuração

```env
FEED_STORE_NAME=Data Center LA
FEED_STORE_URL=https://datacenterla.com
FEED_WEBHOOK_URL=          # opcional: POST do XML quando hash mudar
FEED_SYNC_INTERVAL=15m
```

## Decisões pendentes

Ver [Regras Globais — Pendências](../regras-globais-pendentes.md#8-integrações-e-sincronização).
