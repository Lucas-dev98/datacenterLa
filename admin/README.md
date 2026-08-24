# Data Center LA — Admin Frontend

Painel ERP/CRM em **Next.js 15 + React + Tailwind**.

## Módulos (MVP)

- **Cadastros** — produto + SKU + campos ES (feed Compras Paraguai)
- **Produtos / SKUs** — listagem, edição (ES, canais)
- **Preços** — consulta e alteração por SKU
- **Estoque** — disponibilidade, recebimento, reservas
- **Cotações** — listagem, criar, buscar, enviar, converter em pedido
- **Pedidos** — listagem, confirmar, pagamento, crédito B2B, expedir
- **Clientes** — listagem e cadastro CRM
- **Dashboard** — métricas operacionais, pedidos pendentes, estoque baixo
- **Financeiro** — contas a receber
- **Etiquetas lote** — PDF/HTML batch (cadastro ou unidade AAA)

## Pré-requisitos

Backend rodando em `:8080` com seed:

```bash
cd ../backend
make run   # ou: docker compose up -d && go run ./cmd/server
```

## Configuração

```bash
cp .env.local.example .env.local
```

## Desenvolvimento

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000/login](http://localhost:3000/login)

Credenciais seed: `admin@datacenterla.local` / `Admin@12345678`

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Auth JWT (access + refresh em localStorage)

## Estrutura

```
admin/
  app/
    login/           # login público
    (admin)/         # rotas protegidas + sidebar
      cadastros/
      produtos/
      estoque/
      cotacoes/
  lib/               # api client, auth, types
  components/        # UI + layout
```
