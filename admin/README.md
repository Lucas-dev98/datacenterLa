# Data Center LA — Admin Frontend

Painel ERP/CRM em **Next.js 15 + React + Tailwind**.

## Arquitetura

```
app/(admin)/     → páginas por módulo (client components)
hooks/           → useApiQuery, useApiMutation (fetch padronizado)
lib/api/         → módulos tipados (sales, stock, purchases, pim)
lib/api.ts       → cliente HTTP com refresh JWT
middleware.ts    → redirect para /login sem cookie de sessão
components/      → UI reutilizável + fluxos complexos (PDV, expedição, intake)
```

## Módulos

Cadastros, produtos, preços, estoque, compras, cotações, pedidos, PDV, RMA, devoluções, financeiro, integrações.

## Pré-requisitos

Backend em `:8080` ou `:8082` (ver `lib/config.ts`):

```bash
cd ../backend && make run
```

## Desenvolvimento

```bash
npm install
npm run dev
```

[http://localhost:3000/login](http://localhost:3000/login) — `admin@datacenterla.local` / `Admin@12345678`

## Variáveis

| Variável | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8082` |

## Stack

Next.js App Router · TypeScript · Tailwind v4 · JWT (localStorage + cookie `dcla_session` para middleware)
