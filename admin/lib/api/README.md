# Clientes HTTP do Admin (`lib/api`)

Camada fina sobre `admin/lib/api.ts`. Cada arquivo agrupa endpoints de um bounded context do backend.

## Core

| Arquivo | Função |
|---------|--------|
| `../api.ts` | `api`, `apiBlob`, `apiForm`, `authFetch` com refresh JWT, helpers de browser |
| `client.ts` | Re-exporta o core para imports `@/lib/api/client` |
| `index.ts` | Barrel export de todos os domínios |

## Módulos por domínio

| Módulo | Prefixo API | Responsabilidade |
|--------|-------------|------------------|
| `auth.ts` | `/api/v1/auth` | Login, usuários, roles, MFA |
| `sales.ts` | `/api/v1/sales` | Pedidos, cotações, clientes, leads, dashboard |
| `pos.ts` | `/api/v1/sales/pos` | PDV: walk-in, PIX, busca cliente, comprovante |
| `stock.ts` | `/api/v1/stock` | Saldos, movimentações, intake, inventário, saúde |
| `purchases.ts` | `/api/v1/purchases` | Fornecedores e pedidos de compra |
| `pim.ts` | `/api/v1/pim` | Produtos, SKUs, categorias, cadastro |
| `pricing.ts` | `/api/v1/pricing` | Preços USD e câmbio |
| `finance.ts` | `/api/v1/sales/finance` | Recebíveis, pagáveis, margens |
| `payments.ts` | `/api/v1/payments` | PaymentIntent Stripe |
| `returns.ts` | `/api/v1/sales/returns` | Devoluções comerciais |
| `rma.ts` | `/api/v1/sales/rma` | Garantia técnica / RMA |
| `integrations.ts` | `/api/v1/integrations/compras-paraguai` | Feed XML e sync |
| `labels.ts` | `/api/v1/labels` | Etiquetas de gaveta (PDF/HTML) |

## Convenções

1. **Não chame `api()` direto nas páginas** — use hooks em `admin/hooks/` ou mutations existentes.
2. **Erros**: `ApiClientError` com `code`, `status` e `message` da API Go.
3. **Upload**: `apiForm` para `multipart/form-data` (fotos de intake, devolução, RMA).
4. **Download**: `apiBlob` + `downloadBlob` para PDFs e exportações.

## Relação com hooks

```
Página → hook (use-*-list / use-*-mutations) → *Api (este diretório) → api.ts → backend
```

Ver também: [`../../hooks/README.md`](../../hooks/README.md) e [`../../docs/API_HOOKS.md`](../../docs/API_HOOKS.md).
