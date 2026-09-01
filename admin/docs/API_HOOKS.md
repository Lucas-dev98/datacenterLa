# Admin API hooks

Padrão para leituras e escritas no admin Next.js.

## `useApiQueryFn` — leituras

Use para listagens, detalhes e dashboards. O hook dispara fetch no mount e quando `deps` mudam.

```tsx
const { data, error, loading, refetch } = useStockMovements({ q, movementType, offset });
const items = data?.items ?? [];
```

- **`enabled: false`** — não busca (ex.: detalhe sem id).
- **`refetch()`** — recarrega após mutation ou botão “Atualizar”.
- Trate `data === null` com `?? []` ou optional chaining; o estado inicial é `null`, não `[]`.

Coloque fetchers em `admin/hooks/use-*.ts` chamando módulos `@/lib/api/*`.

Hooks recentes: `useProductDetail`, `useComprasParaguaiDashboard`, `useCustomerReturnsList`, `useRmaCasesList`, `useSalesDashboard`, `useUsersAdmin`, `usePdvBootstrap`.

## `useApiMutation` — escritas

Use para POST/PUT/delete via hooks em `use-*-mutations.ts`:

```tsx
const { run: saveSkuPrice, loading } = useSetSkuPrice();
await saveSkuPrice({ skuId, body });
await refetchList();
```

- **`run`** retorna a resposta da API ou lança erro.
- **`setError`** limpa/define erro local do hook de mutation.
- Após sucesso, chame **`refetch()`** do query hook relacionado (não duplique `load()` manual).

## Quando não migrar

- Integrações de SDK externo (Stripe `confirmPayment` e estado `busy` do Elements).
- Busca em tempo real com debounce no PDV (produtos, clientes, carrinho); bootstrap (`walkIn` + câmbio) e mutations PIX usam hooks.
- Ações pontuais on-demand (blob download, foto expandida, MFA setup, export CSV).

## E2E

Fluxos UI: `scripts/run_e2e_ui_flows.mjs`. CI job `e2e-ui` depende de `backend` e requer billing GitHub ativo.
