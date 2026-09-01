# Data Center LA — Loja pública

Next.js na porta **3001** — catálogo, carrinho e checkout contra `/api/v1/ecommerce`.

## Arquitetura

```
app/                    → rotas (home e /loja com SSR; produto com generateMetadata)
components/             → storefront, catalog-browser, product-detail
lib/server-api.ts       → fetch server-side com ISR (120s)
lib/api.ts              → fetch client-side + carrinho/sessão
lib/catalog-fetch.ts    → filtros q/grupo para fetch no servidor
app/api/ecommerce/      → BFF proxy same-origin (opcional)
```

## Dev

```bash
npm install
npm run dev -- -p 3001
```

| Variável | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` |
| `NEXT_PUBLIC_DEFAULT_WAREHOUSE_ID` | warehouse seed |

SKUs precisam de `publish_ecommerce = true` e preço B2C no admin.

## Performance

- Home usa `fetchCatalogByCodesServer` para destaques (não carrega catálogo inteiro).
- `/loja` passa `q` e `category_id` para a API quando filtrado.
- Página de produto é Server Component com metadata SEO.
