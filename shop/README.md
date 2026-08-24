# Data Center LA — Loja pública

Next.js na porta **3001** — catálogo, carrinho e checkout contra a API `/api/v1/ecommerce`.

## Dev

```bash
npm install
npm run dev -- -p 3001
```

Configure `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`) e `NEXT_PUBLIC_DEFAULT_WAREHOUSE_ID`.

SKUs precisam ter `publish_ecommerce = true` e preço B2C definido no admin.
