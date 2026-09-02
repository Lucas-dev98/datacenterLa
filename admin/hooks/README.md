# Hooks do Admin

Camada de acesso à API do painel Next.js. Cada arquivo agrupa hooks de um domínio (vendas, estoque, PIM, etc.).

## Primitivos

| Arquivo | Função |
|---------|--------|
| `use-api-query.ts` | Leituras com `loading`, `error`, `refetch` e `data` inicial `null` |
| `use-api-mutation.ts` | Escritas com `run`, `loading`, `error` e `setError` |

Guia de uso: [`../docs/API_HOOKS.md`](../docs/API_HOOKS.md).

## Catálogo por domínio

### Auth e usuários

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useUsersAdmin` | query | Usuários + roles para `/usuarios` |
| `useCreateUser` | mutation | Cria conta interna |
| `useUpdateUser` | mutation | Ativa/desativa e altera roles |

### Vendas e CRM

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useSalesDashboard` | query | Dashboard principal (`/`) |
| `useOrdersList` | query | Lista de pedidos com filtro de status |
| `useOrderDetail` | query | Pedido + cliente; expõe `setOrder` para atualização local |
| `useLeadsList` | query | Leads do CRM |
| `useCreateLead` / `useUpdateLeadStatus` | mutation | CRUD de leads |
| `useCustomersList` | query | Clientes (`activeOnly` padrão `true`) |
| `useCreateCustomer` | mutation | Novo cliente |
| `useQuotesList` / `useWebsiteRequestsList` / `useQuoteDetail` | query | Cotações e solicitações do site |
| `useCreateQuote` / `useSendQuote` / `useConvertQuote` | mutation | Fluxo de cotação |
| `useUpdateWebsiteRequestStatus` | mutation | Atualiza solicitação do site |
| `useConfirmOrder` / `useConfirmOrderCredit` / `useRecordOrderPayment` / `useCancelOrder` | mutation | Ciclo de vida do pedido |
| `useShipOrder` | mutation | Expedição com fotos |
| `useAnalyticsDashboard` | query | Analytics financeiro por período |

### PDV e pagamentos

| Hook | Tipo | Descrição |
|------|------|-----------|
| `usePdvBootstrap` | query | Cliente walk-in + câmbio do dia (init do PDV) |
| `usePosPixInit` / `usePosPixConfirm` / `usePosPixCancel` | mutation | Fluxo PIX no balcão |
| `usePosCreateCustomer` | mutation | Cadastro rápido com scan de documento |
| `useCreatePaymentIntent` / `useConfirmPaymentIntent` | mutation | Pagamento cartão (Stripe) |

### Devoluções e RMA

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useCustomerReturnsList` | query | Lista devoluções com busca |
| `useCreateCustomerReturn` | mutation | Abre devolução com fotos |
| `useReturnStep` | mutation | approve → receive → resolve |
| `useRmaCasesList` | query | Lista casos RMA |
| `useCreateRMA` | mutation | Abre RMA com evidências |
| `useRmaStep` | mutation | approve → receive → resolve |

### Financeiro e preços

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useFinanceDashboard` | query | Resumo financeiro por status |
| `useRecordReceivablePayment` / `usePayPayable` | mutation | Baixa de títulos |
| `useExchangeRatesToday` | query | Câmbio do dia |
| `useSyncExchangeRates` | mutation | Sincroniza cotações |
| `useSkuPricingDetail` | query | Preço + resolução B2C/B2B/revenda |
| `useSetSkuPrice` | mutation | Grava preços USD do SKU |

### PIM (produtos)

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useProductCatalog` / `useSkusList` / `useCategoriesList` | query | Catálogo, SKUs e categorias |
| `useProductDetail` | query | Produto + 1º SKU + atributos da categoria |
| `useCategoryAttributes` | query | Atributos de uma categoria |
| `useSkuSearch` | query | Busca SKU (mín. 2 caracteres) |
| `useUpdateProduct` / `useUpdateSku` / `useUploadSkuImage` | mutation | Edição de produto |
| `useBulkCadastro` | mutation | Cadastro produto+SKU em lote |
| `useDeleteSkuProduct` | mutation | Remove SKU (e produto opcional) |
| `useCreateCategory` / `useUpdateCategory` / `useDeleteCategory` | mutation | CRUD categorias |
| `useCreateCategoryAttribute` | mutation | Novo atributo de categoria |

### Compras

| Hook | Tipo | Descrição |
|------|------|-----------|
| `usePurchasesPageData` | query | Fornecedores, POs e mapa de SKUs |
| `usePurchaseOrderDetail` | query | Detalhe de PO |
| `usePendingReceiveOrders` | query | POs aguardando recebimento |
| `usePurchaseOrderReceive` | query | Estado para tela de recebimento |
| `useSaveSupplier` / `useCreateAndSubmitPurchaseOrder` | mutation | Fornecedor e nova PO |
| `usePurchaseReceiveIntake` | mutation | Recebimento com fotos |

### Estoque

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useStockPosition` | query | Saldos e alertas de baixo estoque |
| `useStockMovements` | query | Movimentações paginadas |
| `useIntakeQueue` | query | Fila de intake por armazém |
| `useInventoryLists` | query | Contagens e ajustes |
| `useInventoryUnitByCode` | query | Unidade por código AAA |
| `useStockHealthDashboard` | query | Saúde do estoque (issues, reservas) |
| `useSupplierReturnsList` | query | Devoluções a fornecedor |
| `useExpeditionQueue` | query | Fila de expedição |
| `useReceiveIntakeWithPhotos` / `useIntakeAdvance` / … | mutation | Fluxo de intake |
| `useStockHealthScan` / `useResolveStockHealthIssue` | mutation | Scan e resolução de issues |
| `useCreateStockCount` / … / `useApplyStockAdjustment` | mutation | Contagem e ajuste |
| `useUpdateSupplierReturnStatus` | mutation | Status devolução fornecedor |

### Integrações e etiquetas

| Hook | Tipo | Descrição |
|------|------|-----------|
| `useComprasParaguaiDashboard` | query | Logs + diagnóstico do feed CP |
| `useRunComprasParaguaiSync` | mutation | Dispara sync do feed |
| `useLabelBatchExport` | mutation | Gera PDF/HTML de etiquetas |

## Convenções

1. **Query**: `const items = data ?? []` — estado inicial é `null`, não array vazio.
2. **Mutation**: após `run`, chame `refetch()` do hook de leitura relacionado.
3. **`enabled: false`**: use quando o id ainda não existe (detalhe lazy).
4. **Debounce**: fica na página (ex.: PDV, busca de casos); o hook recebe o termo já debounced.

## Fora dos hooks (lógica local na página)

- Busca em tempo real do PDV (produtos/clientes/carrinho)
- Stripe Elements (`confirmPayment`)
- Download de blobs e previews de foto
- MFA setup em `/configuracoes/seguranca`
