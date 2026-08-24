# Data Center LA — Full stack (Docker Compose)

Sobe Postgres, API Go, admin (:3000) e loja pública (:3001).

## Pré-requisitos

- Docker e Docker Compose v2

## Subir tudo

```bash
docker compose up --build
```

Em outro terminal, rode o seed (primeira vez):

```bash
docker compose run --rm seed
```

## URLs

| Serviço | URL |
|---------|-----|
| API | http://localhost:8080 |
| Admin | http://localhost:3000 |
| Loja | http://localhost:3001 |
| Postgres | localhost:5434 |

**Login admin (dev):** `admin@datacenterla.local` / `Admin@12345678`

## Desenvolvimento local (sem Docker)

```bash
# Postgres
cd backend && docker compose up -d

# API
cd backend && make run

# Seed
cd backend && go run ./cmd/seed

# Admin
cd admin && npm run dev

# Loja
cd shop && npm run dev -- -p 3001
```

## Variáveis

| Variável | Default |
|----------|---------|
| `JWT_SECRET` | dev secret (alterar em produção) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` |
| `STRIPE_SECRET_KEY` | *(vazio — usa gateway mock)* |
| `STRIPE_PUBLISHABLE_KEY` | *(vazio)* |
| `STRIPE_WEBHOOK_SECRET` | *(vazio — webhook Stripe opcional)* |
| `MFA_REQUIRED` | `false` |

Em produção, configure `NEXT_PUBLIC_API_URL` para a URL pública da API acessível pelo browser.

### Stripe (opcional)

Sem `STRIPE_SECRET_KEY`, checkout e ERP usam gateway **mock** (confirmação imediata).

Com Stripe configurado:

1. Defina as três variáveis na API (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`).
2. Loja (`/checkout`) e ERP (`/pedidos/[id]`) exibem Stripe Elements para cartão.
3. Webhook (recomendado em produção):

```bash
stripe listen --forward-to localhost:8080/api/v1/ecommerce/payments/webhook/stripe
```

Use o signing secret exibido pelo CLI em `STRIPE_WEBHOOK_SECRET`.

Cartões de teste: `4242 4242 4242 4242`, qualquer data futura e CVC.
