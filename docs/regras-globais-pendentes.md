# Regras Globais e Fluxos — Pendências

> **Supersedido por:** [Regras Globais v1.0](./regras-globais.md) e [Spec Técnica — Estoque](./modulos/estoque/especificacao-tecnica.md)

Documento histórico de checklist. A maioria das decisões foi fechada na v1.0 das Regras Globais. Itens marcados `[REVISAR]` ainda precisam confirmação operacional.

---

## Status geral

| Área | Status |
|------|--------|
| Visão geral e arquitetura macro | ✅ Definido |
| Filosofia do estoque (motor transacional) | ✅ Definido |
| Módulos e escopo inicial | ✅ Definido |
| Stack tecnológica (Go, PostgreSQL, React/Next.js) | ✅ Definido |
| Integração Compras Paraguai (princípios) | ✅ Definido |
| Regras comerciais detalhadas | ⬜ Pendente |
| Fluxos ponta a ponta | ⬜ Pendente |
| Regras financeiras | ⬜ Pendente |
| Política de preços | ⬜ Pendente |
| Fluxos operacionais de estoque | ⬜ Pendente |
| UX e wireframes | ⬜ Pendente |
| Modelo de dados | ⬜ Pendente |
| Requisitos não funcionais | ⬜ Pendente |

---

## 1. Regras comerciais

Impactam Vendas, Estoque e Financeiro simultaneamente.

### Preços e descontos

- [ ] Como funciona o preço B2B?
- [ ] Como funciona o preço B2C?
- [ ] Revendedor terá tabela própria?
- [ ] Vendedor pode dar desconto? Até quanto?
- [ ] Desconto acima do limite exige aprovação?
- [ ] Será possível negociar preço livremente?

### Cotações

- [ ] Qual é a validade padrão de uma cotação?
- [ ] Uma cotação comum pode reservar produto? (decisão atual: **não**, salvo modalidade explícita futura)
- [ ] Preço da cotação fica congelado durante a validade?
- [ ] Após vencimento, preço pode mudar na reconversão?

### Pedidos e confirmação

- [ ] Quando um pedido é considerado **confirmado**?
- [ ] Quando o estoque é **reservado**?
- [ ] Quando o estoque é **efetivamente baixado**?
- [ ] Venda pode ser cancelada? Até qual etapa?
- [ ] Como funciona devolução parcial e total?

### Canais

- [ ] Regras B2B (crédito, prazo, faturamento)
- [ ] Regras B2C (pagamento à vista, parcelamento)
- [ ] Regras para revendedores (margem mínima, comissão)

---

## 2. Fluxos completos de operação

Desenhar ponta a ponta antes do código.

### Compra de fornecedor

```
Fornecedor → Pedido de compra → Recebimento → Conferência
→ Cadastro/identificação das unidades → Entrada no estoque → Financeiro
```

- [ ] Quem recebe? Quem confere?
- [ ] Quando a unidade ganha código único?
- [ ] Quando fica disponível para venda?

### Venda presencial / vendedor

```
Cliente → Atendimento → Cotação → Negociação → Pedido → Reserva
→ Pagamento → Separação → Conferência → Saída → Entrega
→ Financeiro → Pós-venda
```

### Venda e-commerce

```
Cliente → Carrinho → Checkout → Pagamento → Pedido → Estoque
→ Separação → Expedição → Entrega
```

### Devolução / RMA

```
Cliente → Solicitação → Análise → Recebimento → Conferência
→ Decisão → Estoque / Garantia / Financeiro
```

---

## 3. Regras financeiras

### Moedas

- [ ] Quais moedas serão usadas? (USD principal? PYG também?)
- [ ] Como será feita conversão? Fonte da cotação?
- [ ] Arredondamento e precisão decimal

### Reconhecimento de receita

- [ ] Quando uma venda entra no financeiro? (pedido emitido vs pagamento confirmado)
- [ ] Venda parcelada — reconhecimento por parcela ou total?
- [ ] Pagamento parcial / sinal / entrada
- [ ] Reembolso — fluxo e estorno de estoque
- [ ] Chargeback de cartão
- [ ] Cancelamento de pagamento

### Taxas e margens

- [ ] Taxas de cartão — quem absorve?
- [ ] Taxas de gateway
- [ ] Custo do produto — FIFO, médio, por unidade?
- [ ] Cálculo de margem bruta e líquida

### Fiscal

- [ ] IVA e demais regras fiscais aplicáveis no Paraguai
- [ ] Relação preço com/sem IVA nos canais

---

## 4. Política de preços

Um mesmo produto pode ter múltiplas camadas:

| Camada | Definido? |
|--------|-----------|
| Custo | ⬜ |
| Preço mínimo | ⬜ |
| Preço padrão B2C | ⬜ |
| Preço B2B | ⬜ |
| Preço revendedor | ⬜ |
| Preço promocional | ⬜ |
| Preço com IVA | ⬜ |
| Preço sem IVA | ⬜ |
| Preço USD | ⬜ |
| Preço PYG | ⬜ |

### Governança

- [ ] Quem pode alterar preço?
- [ ] Preço pode ser agendado (início/fim)?
- [ ] Promoção tem janela temporal?
- [ ] **Preço histórico preservado?** (recomendado: sim)
- [ ] Auditoria de alteração de preço

---

## 5. Fluxos operacionais de estoque

Arquitetura definida; fluxos operacionais detalhados pendentes.

### Entrada

```
Recebido → Em conferência → Identificado → Etiquetado → Localizado → Disponível
```

- [ ] Matriz de transições de status permitidas
- [ ] Quem pode avançar cada etapa

### Venda

```
Disponível → Reservado → Separação → Conferência → Vendido
```

- [ ] Tempo máximo de reserva antes de expirar
- [ ] O que acontece com reserva expirada

### Problema / avaria

```
Disponível → Bloqueado → Diagnóstico → Avariado / Disponível / RMA
```

### Inventário

```
Inventário iniciado → Contagem → Divergência? → Recontagem
→ Aprovação → Ajuste → Auditoria
```

- [ ] Limite de ajuste sem aprovação
- [ ] Limite que exige dupla aprovação

### Detecção de inconsistências (itens fantasmas)

- [ ] Regras automáticas de detecção
- [ ] SLA para resolução de divergências abertas

---

## 6. Experiência e telas (wireframes)

### Dashboards

- [ ] Administrador (faturamento, estoque, alertas, divergências)
- [ ] Vendedor (cotações, clientes, follow-ups, estoque disponível)
- [ ] Estoque (recebimento, scanner, inventário, movimentações)
- [ ] Financeiro (entradas, saídas, pendências, fluxo de caixa)

### E-commerce

- [ ] Home, categorias, produto, carrinho, checkout, área do cliente

### Portal revendedor (futuro)

- [ ] Escopo mínimo do portal

---

## 7. Modelo de dados

Entidades previstas (relacionamentos e integridade a definir):

```
users, roles, permissions
organizations, departments, employees
customers, companies, suppliers, resellers
products, product_categories, product_attributes, product_attribute_values
inventory_units, inventory_locations, inventory_movements, inventory_reservations
quotations, quotation_items
orders, order_items
payments, financial_transactions
stock_counts, stock_adjustments
warranties, rma_cases
audit_logs, integration_events
```

### Prioridade de modelagem

1. **Estoque** — constraints no banco para impedir inconsistências
2. Produtos / PIM — atributos dinâmicos
3. Pedidos e reservas — integridade com estoque
4. Financeiro — vínculo com operações

---

## 8. Integrações e sincronização

### Compras Paraguai

- [ ] Frequência de geração do feed (tempo real, batch, híbrido)
- [ ] Estratégia de retentativa em falha
- [ ] Produtos elegíveis vs excluídos do feed
- [ ] Regra de `estoque` no feed: disponível por SKU ou contagem de unidades?

### Futuras

- [ ] Gateways de pagamento
- [ ] WhatsApp, e-mail, SMS
- [ ] Transportadoras
- [ ] APIs de fornecedores
- [ ] Credenciais de integração (sem depender de contas de usuário)

---

## 9. Requisitos não funcionais

### Segurança

- [ ] Criptografia em trânsito e repouso
- [ ] Rate limiting
- [ ] Segregação de permissões
- [ ] Política de senhas e bloqueio

### Backup e recuperação

- [ ] Frequência, retenção, testes de restore

### Performance

- [ ] Volume esperado: produtos, usuários, pedidos/dia
- [ ] Crescimento previsto (12–24 meses)

### Disponibilidade

- [ ] Comportamento quando integração externa falha
- [ ] Filas e dead-letter para eventos

### Observabilidade

- [ ] Logs estruturados
- [ ] Monitoramento e alertas
- [ ] Rastreamento de erros (Sentry ou equivalente)

### Testes

- [ ] Estratégia de testes (unitário, integração, e2e)
- [ ] Critérios de aceite por módulo
- [ ] Cenários críticos de estoque (prioridade máxima)

---

## 10. Matriz de permissões

Perfis previstos (permissões granulares, não apenas por cargo):

- Administrador Geral
- Administrador
- Vendas
- Suporte
- Financeiro
- Estoque
- Compras
- Gerência
- Revendedor

- [ ] Matriz completa: perfil × operação × aprovação necessária
- [ ] Operações com dupla aprovação (ajustes acima de limite, etc.)

---

## Checklist consolidado

- [ ] Regras comerciais
- [ ] Política de preços e descontos
- [ ] Regras B2B / B2C / revendedores
- [ ] Fluxo de compra e recebimento
- [ ] Fluxo completo do estoque
- [ ] Regras de reserva e baixa
- [ ] Fluxo de cotação e pedido
- [ ] Fluxo de pagamento
- [ ] Regras financeiras e moedas
- [ ] IVA e fiscal
- [ ] Cancelamentos e reembolsos
- [ ] Devoluções, garantia e RMA
- [ ] Logística e entrega
- [ ] Estados e workflows de cada operação
- [ ] Matriz completa de permissões
- [ ] Dashboards e wireframes
- [ ] Modelo de dados
- [ ] APIs e contratos de integração
- [ ] Estratgia de sincronização Compras Paraguai
- [ ] Segurança, backup, logs
- [ ] Estratégia de testes
- [ ] Critérios de aceite por módulo

---

## Conclusão

Falta **pouco** para o desenho macro completo. O que já está sólido:

- Arquitetura modular com comunicação por eventos
- Estoque como motor transacional e fonte única de verdade
- PIM com atributos dinâmicos e unidade física rastreável
- Integração Compras Paraguai como canal derivado do ERP

O gargalo agora não é "o que o sistema faz", e sim **fechar as regras que atravessam módulos** — especialmente comercial, financeiro e os momentos exatos de reserva/baixa de estoque. Com o documento de Regras Globais fechado, a especificação técnica do Estoque pode começar com confiança.
