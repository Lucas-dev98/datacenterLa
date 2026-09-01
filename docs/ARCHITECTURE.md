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

- OpenAPI base: [`openapi.yaml`](openapi.yaml) (paths aligned with admin `lib/api/*` and E2E flows)
- Regras de negócio: [`regras-globais.md`](regras-globais.md)

## CI

`.github/workflows/ci.yml` — testes Go (integração), typecheck + build Next.js (admin/shop), smoke/fluxos API (`e2e_*`.py) e crawl UI admin (`run_e2e_admin_crawl.mjs`).
