# Arquitetura — Data Center LA

Monólito modular com três processos front-end e um backend Go.

## Camadas

| Camada | Responsabilidade |
|--------|------------------|
| **Handler** | HTTP, auth, decode/encode JSON |
| **Service** | Regras de negócio, orquestração entre domínios |
| **Repository** | SQL (pgx), transações |

## Domínios (backend)

`auth`, `shopauth`, `pim`, `pricing`, `stock`, `purchases`, `sales`, `payments`, `integrations`, `platform`

## Front-ends

| App | Padrão |
|-----|--------|
| **admin** | `hooks/use*List`, `useApiQueryFn` + `lib/api/*`, `middleware.ts` |
| **shop** | SSR (`server-api.ts`) + client (`lib/api/*`), BFF opcional em `app/api/ecommerce` |

## Contratos

- OpenAPI: [`openapi.yaml`](openapi.yaml) — schemas + paths operacionais
- Regras de negócio: [`regras-globais.md`](regras-globais.md)

## Deploy / observabilidade

- Health: `GET /health/live` (liveness), `GET /health/ready` (readiness + Postgres)
- Staging: [`deploy/README.md`](../deploy/README.md) + `docker-compose.staging.yml`
- CI staging smoke: `.github/workflows/staging.yml`

## CI

`.github/workflows/ci.yml` — testes Go, build Next.js, smoke/fluxos API, UI flows+crawl (Playwright), staging smoke (`staging.yml`).
