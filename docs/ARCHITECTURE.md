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
| **shop** | SSR (`server-api.ts`) + client (`api.ts`), BFF opcional em `app/api/ecommerce` |

## Contratos

- OpenAPI base: [`openapi.yaml`](openapi.yaml)
- Regras de negócio: [`regras-globais.md`](regras-globais.md)

## CI

`.github/workflows/ci.yml` — testes Go (integração), typecheck TS, smoke E2E da API (`e2e_api_smoke.py`) e fluxos (`e2e_flows.py`: PO receive-intake, devolução).
