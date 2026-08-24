# Regras Globais e Fluxos de Negócio — Data Center LA

Documento de referência com **decisões fechadas** para implementação. Valores marcados como `[REVISAR]` devem ser confirmados pela operação antes do go-live.

**Versão:** 1.0 · **Status:** Base para especificação técnica

---

## 1. Regras comerciais

### 1.1 Canais e tipos de cliente

| Canal | Cliente | Pagamento padrão | Preço base |
|-------|---------|------------------|------------|
| ERP / Vendedor | B2B corporativo | Prazo negociado ou à vista | Tabela B2B |
| ERP / Vendedor | Revendedor | À vista ou crédito pré-aprovado | Tabela Revendedor |
| E-commerce | B2C | À vista no checkout | Preço B2C |
| Compras Paraguai | Lead externo | Redireciona para e-commerce/loja | Preço B2C + IVA |

### 1.2 Política de preços

Cada SKU possui camadas de preço:

| Camada | Descrição | Quem vê |
|--------|-----------|---------|
| `cost` | Custo de aquisição (por unidade ou médio do SKU) | Estoque, Compras, Admin, Financeiro |
| `min_price` | Piso comercial — venda abaixo exige aprovação | Gerência, Admin |
| `price_b2c` | Preço público consumidor final (USD) | Todos (vendedores, site, feed) |
| `price_b2b` | Preço corporativo padrão | Vendedores, B2B |
| `price_reseller` | Preço revendedor | Revendedores, vendedores autorizados |
| `price_promo` | Promocional temporário | Sobrepõe B2C/B2B conforme canal |
| `price_with_iva` | Calculado: `price × (1 + tax_rate)` | Feed Compras Paraguai, checkout PY |

**Regras:**

- Moeda **principal:** USD. PYG exibido por conversão (seção 3.1).
- **Histórico de preço preservado** — toda alteração gera registro em `price_history`.
- Preço promocional tem `starts_at` / `ends_at`; fora da janela, volta ao preço base do canal.
- Cliente B2B pode ter **tabela de preço customizada** que sobrepõe `price_b2b` por SKU ou categoria.
- Revendedor usa **tabela própria** (`price_reseller` ou tabela customizada por revendedor).

### 1.3 Descontos

| Ator | Desconto máximo sem aprovação | Aprovação |
|------|-------------------------------|-----------|
| Vendedor | 5% sobre preço autorizado do canal | Gerência |
| Gerência | 15% | Admin Geral (acima de 15%) |
| Admin / Admin Geral | Sem limite (auditado) | — |

- Desconto nunca pode colocar preço **abaixo de `min_price`** sem aprovação de Admin Geral.
- Desconto aplicado na **cotação/pedido**, não altera o preço base do SKU.
- Negociação livre permitida **dentro** dos limites acima; acima exige workflow de aprovação.

### 1.4 Cotações

| Regra | Decisão |
|-------|---------|
| Validade padrão | **7 dias corridos** desde envio |
| Validade customizável | Sim, por cotação (mín. 1 dia, máx. 30 dias) |
| Reserva de estoque | **Não** — cotação comum não reserva |
| Modalidade "Cotação com reserva" | Futuro — flag explícita, TTL 48h, aprovação Gerência |
| Preço congelado | Sim, durante validade da cotação |
| Após vencimento | Conversão recalcula preço atual; usuário confirma antes de gerar pedido |
| Status | Rascunho → Enviada → Visualizada → Em negociação → Aprovada / Recusada / Expirada → Convertida |

### 1.5 Pedidos — confirmação, reserva e baixa

**Momento de cada operação no estoque:**

| Evento | Ação no estoque | Observação |
|--------|-----------------|------------|
| Cotação criada/enviada | Nenhuma | Apenas consulta disponibilidade |
| Pedido criado (rascunho) | Nenhuma | Valida disponibilidade, não bloqueia |
| **Pedido confirmado** | **Reserva** | Unidades ou qty reservada por SKU |
| Pagamento confirmado (B2C) | Mantém reserva | Pedido avança para separação |
| Crédito B2B aprovado | Mantém reserva | Equivalente a pagamento confirmado |
| **Separação concluída + conferência** | **Baixa definitiva** | Status unidade → Vendida |
| Cancelamento antes da separação | Libera reserva | — |
| Cancelamento após separação | Estorno + devolução ao estoque | Workflow de devolução |

**Pedido confirmado** = usuário/vendedor confirma OU e-commerce recebe pagamento aprovado OU crédito B2B aprovado.

**TTL de reserva:**

| Contexto | TTL | Expiração |
|----------|-----|-----------|
| E-commerce — carrinho | 30 min | Libera qty do carrinho (soft hold opcional fase 2) |
| Pedido confirmado B2C | 48h | Alerta → revisão manual |
| Pedido confirmado B2B | 5 dias úteis | Alerta → contato comercial |
| Reserva explícita (cotação especial) | 48h | Libera automaticamente |

### 1.6 Cancelamento

| Etapa do pedido | Cancelamento | Estoque | Financeiro |
|-----------------|-------------|---------|------------|
| Rascunho | Livre | N/A | N/A |
| Confirmado, não pago | Sim | Libera reserva | Cancela cobrança pendente |
| Pago, não separado | Sim (aprovação Gerência) | Libera reserva | Reembolso total |
| Em separação | Sim (aprovação Admin) | Reverte reserva parcial | Reembolso proporcional |
| Separado / expedido | Não — vira devolução | Devolução | Reembolso via devolução |
| Entregue | Devolução/RMA | Conforme inspeção | Conforme política |

### 1.7 Devoluções

| Tipo | Prazo | Condição | Estoque | Reembolso |
|------|-------|----------|---------|-----------|
| Arrependimento B2C | 7 dias `[REVISAR]` | Embalagem intacta, sem uso | Disponível ou Bloqueado p/ inspeção | Total |
| Defeito / garantia | Prazo garantia | Inspeção técnica | Em garantia / RMA / Avariada | Troca ou reembolso |
| Devolução parcial | — | Por item do pedido | Por unidade | Proporcional |
| Devolução B2B | Negociado | Conforme contrato | Conferência obrigatória | Conforme contrato |

Fluxo: Solicitação → Aprovação → Recebimento físico → Conferência → Decisão (reintegrar / RMA / baixar) → Financeiro.

### 1.8 B2B — crédito e prazo

- Cliente B2B tem `credit_limit` e `payment_terms` (ex: 30/60 dias).
- Pedido confirmado com crédito: reserva estoque + gera conta a receber com vencimento.
- Pedido acima do limite de crédito: **bloqueado** até aprovação Financeiro/Gerência.
- Faturamento: emissão de documento fiscal conforme regras locais `[REVISAR com contador]`.

### 1.9 Revendedores

- Tabela de preço própria (`price_reseller` ou customizada).
- Margem mínima sobre custo: **10%** `[REVISAR]` — sistema alerta, não bloqueia venda.
- Comissão do vendedor responsável: módulo futuro; campo `reseller.responsible_seller_id` reservado.
- Revendedor **não** ajusta estoque nem vê custo.

---

## 2. Fluxos ponta a ponta

### 2.1 Compra de fornecedor → estoque

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌────────────┐
│ Pedido de   │───>│ Recebimento  │───>│ Conferência │───>│ Identific. │
│ compra      │    │ físico       │    │ qty/qualid. │    │ unidades   │
└─────────────┘    └──────────────┘    └─────────────┘    └─────┬──────┘
                                                                  │
    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐       │
    │ Financeiro  │<───│ Movimentação │<───│ Etiquetagem │<──────┘
    │ (conta pagar)│    │ ENTRADA      │    │ + localiz.  │
    └─────────────┘    └──────────────┘    └─────────────┘
```

| Etapa | Responsável | Permissão | Resultado |
|-------|-------------|-----------|-----------|
| Recebimento físico | Estoque | `inventory.receive` | Status: Recebida |
| Conferência | Estoque | `inventory.inspect` | Status: Em conferência → Identificado ou Bloqueado |
| Geração código | Sistema (automático) | — | Código AAA0001… |
| Etiquetagem | Estoque | `inventory.label` | Etiqueta gerada |
| Localização | Estoque | `inventory.locate` | DEP01-A-03-02 |
| Disponível | Estoque | `inventory.release` | Status: Disponível, qty++ |

**Custo:** registrado por unidade na entrada (herda do pedido de compra).

### 2.2 Venda presencial / vendedor

```
Cliente → Cotação (opcional) → Pedido rascunho → Confirmação
    → RESERVA → Pagamento/crédito → Separação → Conferência
    → BAIXA (Vendida) → Expedição → Entrega → Financeiro → CRM
```

### 2.3 Venda e-commerce

```
Browse → Carrinho (soft hold 30min fase 2) → Checkout → Pagamento gateway
    → Pedido confirmado → RESERVA → Separação → Expedição → Entrega
```

Pagamento recusado: pedido cancelado, sem reserva.

### 2.4 Devolução / RMA

```
Solicitação → Triagem Suporte → Aprovação → Envio cliente → Recebimento
    → Conferência → Diagnóstico
        ├── Reintegrar → Disponível (movimentação DEVOLUÇÃO)
        ├── RMA fornecedor → Em RMA
        └── Avariada → Avariada / Baixada
    → Financeiro (reembolso/troca) → CRM (histórico)
```

---

## 3. Regras financeiras

### 3.1 Moedas

| Moeda | Uso |
|-------|-----|
| **USD** | Moeda base interna — custos, preços, margens, relatórios |
| **PYG** | Exibição e-commerce local, conversão informativa |

- Taxa de conversão USD/PYG: tabela `exchange_rates`, atualizada **diariamente** (manual ou API `[REVISAR fonte]`).
- Arredondamento PYG: inteiro (sem centavos).
- Arredondamento USD: 2 casas decimais.

### 3.2 IVA (Paraguai)

- Taxa padrão: **10%** `[REVISAR com contador]`.
- `price_with_iva = round(price_usd × 1.10, 2)`.
- Feed Compras Paraguai envia `preco` (sem IVA) e `price_iva` (com IVA).
- E-commerce PY: exibe preço com IVA para consumidor paraguaio.

### 3.3 Reconhecimento de receita

| Modelo | Reconhecimento |
|--------|----------------|
| B2C — pagamento à vista | Na **confirmação do pagamento** |
| B2B — à vista | Na confirmação do pagamento |
| B2B — a prazo | Na **emissão do pedido confirmado** (conta a receber) |
| Parcelado | Por parcela recebida `[REVISAR gateway]` |

### 3.4 Pagamentos

Formas iniciais: transferência bancária, dinheiro, cartão (gateway futuro), PIX `[BR apenas se aplicável]`.

| Situação | Regra |
|----------|-------|
| Pagamento parcial / sinal | Permitido B2B; pedido parcialmente pago; separação exige saldo ou aprovação |
| Reembolso | Estorna financeiro + estoque (se já baixado, via devolução) |
| Chargeback | Bloqueia cliente; alerta Financeiro; estoque via devolução se entregue |
| Taxa cartão | Absorvida pela empresa `[REVISAR]`; registrada em `payment.fee_amount` |

### 3.5 Custo e margem

- Custo por **unidade física** quando rastreado; fallback custo médio do SKU.
- Margem bruta pedido: `(preço_venda - custo) / preço_venda × 100`.
- Margem líquida: após taxas de pagamento e frete `[fase 2]`.

---

## 4. Regras de estoque (operacionais)

Referência completa: [Especificação Técnica — Estoque](./modulos/estoque/especificacao-tecnica.md)

### 4.1 Saldos

```
disponível = físico_disponível - reservado
físico       = count(unidades WHERE status IN disponíveis_físicos)
reservado    = sum(reservas ativas)
```

### 4.2 Ajustes

| Valor do ajuste (USD eq.) | Aprovação |
|---------------------------|-----------|
| Até USD 500 | Supervisor Estoque |
| USD 500 – 2.000 | Gerência |
| Acima USD 2.000 | Dupla aprovação (Gerência + Admin) |

- Justificativa **obrigatória**.
- Movimentação de ajuste imutável; reversão via movimento inverso.

### 4.3 Inventário

- Divergência → recontagem automática sugerida.
- 2ª divergência → investigação obrigatória antes de ajuste.
- SLA divergência aberta: **5 dias úteis** → escala para Gerência.

### 4.4 Itens fantasmas — detecção automática (job diário)

- Unidade vendida com flag disponível
- Serial/código duplicado
- Reserva sem pedido ativo
- Saldo negativo por SKU/depósito
- Unidade sem localização há > 7 dias
- Status incompatível com movimentação recente

---

## 5. Integrações

### 5.1 Compras Paraguai

| Parâmetro | Decisão |
|-----------|---------|
| Frequência | Event-driven + batch de segurança a cada **15 min** |
| Campo `estoque` | Qty **disponível** agregada por SKU |
| Produtos no feed | SKU com flag `publish_compras_paraguai = true` |
| Falha de entrega | Fila com 3 retentativas (1m, 5m, 15m); alerta se esgotar |
| ERP indisponível | Feed anterior permanece; e-commerce independente |

### 5.2 Eventos internos (outbox)

Todo módulo publica eventos via **transactional outbox**. Consumidores: financeiro, CRM, integrações, notificações.

Eventos de estoque críticos: `stock.reserved`, `stock.released`, `stock.shipped`, `stock.adjusted`, `stock.available_changed`.

---

## 6. Permissões — matriz resumida

| Operação | Vendedor | Estoque | Financeiro | Gerência | Admin |
|----------|----------|---------|------------|----------|-------|
| Ver produtos/preços canal | ✓ | ✓ | — | ✓ | ✓ |
| Ver custo | — | ✓ | ✓ | ✓ | ✓ |
| Criar cotação/pedido | ✓ | — | — | ✓ | ✓ |
| Confirmar pedido B2B crédito | — | — | ✓ | ✓ | ✓ |
| Receber/conferir estoque | — | ✓ | — | ✓ | ✓ |
| Ajuste estoque | — | ✓ `[limite]` | — | ✓ | ✓ |
| Aprovar desconto > 5% | — | — | — | ✓ | ✓ |
| Alterar preço base | — | — | — | ✓ | ✓ |
| Dupla aprovação ajuste | — | — | — | ✓ | ✓ |
| Auditoria completa | — | — | ✓ | ✓ | ✓ |

Matriz completa na spec de auth (Etapa 2).

---

## 7. Requisitos não funcionais (baseline)

| Área | Decisão inicial |
|------|-----------------|
| Produtos/SKUs | ~5.000 SKUs, ~50.000 unidades físicas |
| Pedidos | ~50/dia inicial, pico 200/dia |
| Usuários internos | ~20 |
| Uptime ERP | 99.5% |
| Backup DB | Diário + WAL contínuo; retenção 30 dias; restore test mensal |
| TLS | Obrigatório em trânsito |
| Senha | Mín. 12 chars, MFA obrigatório internos |
| Rate limit API | 100 req/min por token |
| Logs | JSON estruturado, retenção 90 dias |
| Filas | PostgreSQL outbox + worker Go (Redis/NATS `[REVISAR]` fase 2) |
| Testes estoque | Cobertura mínima 90% nos fluxos de reserva/baixa/ajuste |

---

## 8. Wireframes — escopo MVP

Prioridade de telas (sem design visual ainda — fluxos definidos):

1. **Estoque:** recebimento, busca unidade (scanner), movimentações, inventário, divergências, saúde
2. **Vendedor:** cotações, pedidos, clientes, consulta estoque/preço
3. **Admin:** dashboard alertas + saúde estoque + vendas do dia
4. **E-commerce:** catálogo, produto, carrinho, checkout, pedidos

Wireframes detalhados: documento separado na Etapa de frontend.

---

## 9. Itens marcados para revisão operacional

- [ ] Prazo devolução B2C (7 dias proposto)
- [ ] Margem mínima revendedor (10% proposto)
- [ ] Taxa IVA definitiva
- [ ] Fonte câmbio USD/PYG
- [ ] Absorção taxa cartão
- [ ] Limites de ajuste de estoque em USD
- [ ] Regras fiscais/documentos Paraguai

---

## Próximo documento

→ [Especificação Técnica — Estoque](./modulos/estoque/especificacao-tecnica.md)
