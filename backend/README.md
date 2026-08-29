# Backend — Data Center LA

API em Go — módulos **Auth**, **PIM**, **Pricing**, **Sales/CRM**, **Finance**, **E-commerce**, **Estoque** e **Etiquetas**.

## Pré-requisitos

- Go 1.23+
- Docker (PostgreSQL)

## Subir banco

```bash
cd backend
docker compose up -d
make seed
```

### PostgreSQL (dev)

| Campo | Valor |
|-------|-------|
| Host | `localhost` |
| Porta | `5434` |
| Banco | `datacenterla` |
| Usuário | `datacenterla` |
| Senha | `datacenterla` |

**Adminer (web):** com `docker compose up -d`, abra [http://localhost:8081](http://localhost:8081), sistema **PostgreSQL**, servidor **`postgres`** (dentro do Docker) ou **`host.docker.internal:5434`** se o banco estiver só na máquina host.

Também pode usar DBeaver, pgAdmin ou `psql`:

```bash
psql postgres://datacenterla:datacenterla@localhost:5434/datacenterla
```

### Credenciais dev (seed)

| Campo | Valor |
|-------|-------|
| Admin email | `admin@datacenterla.local` |
| Admin password | `Admin@12345678` |
| SKU seed | `000001` |
| Warehouse | `11111111-1111-1111-1111-111111111001` |

## Autenticação

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@datacenterla.local","password":"Admin@12345678"}' | jq -r .access_token)

# MFA (opcional)
curl -s -X POST http://localhost:8080/api/v1/auth/mfa/setup \
  -H "Authorization: Bearer $TOKEN" | jq
```

Rotas protegidas exigem `Authorization: Bearer <token>`.

## Módulos e rotas

| Prefixo | Módulo |
|---------|--------|
| `/api/v1/auth` | Login, refresh, MFA TOTP, usuários |
| `/api/v1/pim` | Produtos, categorias, SKUs, cadastros, etiquetas |
| `/api/v1/pricing` | Preços por SKU, histórico, resolução por canal |
| `/api/v1/sales` | Clientes (CRM), cotações, pedidos, pagamentos, crédito B2B |
| `/api/v1/ecommerce` | Catálogo público, carrinho, checkout |
| `/api/v1/stock` | Estoque, reservas, movimentações |
| `/api/v1/labels/batch` | Impressão em lote (PDF/HTML) |

## Fluxo comercial (MVP)

```
Cotação → Enviar (7 dias) → Converter em pedido → Confirmar (reserva estoque)
    → Pagamento ou Crédito B2B → Separar/Ship (baixa estoque)
```

## E-commerce

```bash
curl -s "http://localhost:8080/api/v1/ecommerce/catalog?warehouse_id=11111111-1111-1111-1111-111111111001" | jq
```

## Impressão em lote

```bash
curl -s -X POST http://localhost:8080/api/v1/labels/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"format":"pdf","items":[{"type":"cadastro","code":"000001"},{"type":"unit","code":"AAA0001"}]}' \
  -o labels.pdf
```

## Etiquetas individuais

```bash
curl -s "http://localhost:8080/api/v1/pim/skus/code/000001/label?format=pdf" \
  -H "Authorization: Bearer $TOKEN" -o sku.pdf
```

## E-mail (código de login da loja + notificações)

### Resend (recomendado)

1. Crie conta em [resend.com](https://resend.com) e gere uma API key.
2. No `backend/.env`:

```env
RESEND_API_KEY=re_sua_chave
RESEND_FROM=Data Center LA <onboarding@resend.dev>
```

3. Reinicie a API: `make run`

**Plano gratuito sem domínio verificado:** só é possível enviar para o **mesmo e-mail** cadastrado na conta Resend. Para enviar a qualquer cliente, verifique seu domínio em Resend → Domains.

Teste rápido:

```bash
make send-test
```

### Dev local (Mailpit)

```bash
docker compose up -d mailpit   # inbox http://localhost:8025
make run-mailpit
```

Com `make run`, o servidor carrega automaticamente o arquivo `.env` na pasta `backend/`.

## Rodar API

```bash
make run
```

Workers em background: expiração de reservas (5 min), outbox (30 s), sync do feed Compras Paraguai (15 min, configurável via `FEED_SYNC_INTERVAL`).

## Integração Compras Paraguai

Feed XML público (servido do cache; gera sync sob demanda se cache vazio):

```bash
curl -s http://localhost:8080/api/v1/integrations/compras-paraguai/feed.xml | head -40
curl -s http://localhost:8080/api/v1/integrations/compras-paraguai/feed | jq
```

Endpoints protegidos (JWT + permissão PIM):

```bash
# Listar logs de sincronização
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/integrations/compras-paraguai/sync/logs | jq

# Disparar sync manual
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/integrations/compras-paraguai/sync/run | jq
```

Requisitos por SKU no feed:
- `publish_compras_paraguai=true`
- Preço B2C USD
- Tradução ES (`name_es`, `description_es` ou `generated_description_es`)
- Estoque disponível agregado

Variáveis opcionais: `FEED_WEBHOOK_URL` (POST do XML após hash alterar), `FEED_SYNC_INTERVAL` (padrão 15m). Retentativas de entrega: 1m, 5m, 15m.

## Admin frontend (`admin/`)

```bash
cd admin && npm run dev   # http://localhost:3000
```

Ver `admin/README.md`.

## Testes de integração

```bash
make test-integration   # sobe Postgres, seed e roda todos os testes -tags=integration
```


## Estrutura

```
backend/internal/
  auth/          # JWT, MFA, roles, permissions
  pricing/       # Preços SKU + histórico
  sales/         # CRM, cotações, pedidos, financeiro integrado
  pim/           # Produtos / PIM
  stock/         # Estoque
  labels/        # Batch print handler
  platform/
    labels/      # Templates HTML/PDF/QR
    worker/      # Outbox consumer
```

## Documentação

- [Regras Globais](../docs/regras-globais.md)
- [Modelo de Identificação](../docs/modulos/produtos/modelo-identificacao.md)
