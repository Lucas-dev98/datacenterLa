# Data Center LA — Documentação Consolidada da Plataforma

## 1. Visão geral

A Data Center LA terá uma plataforma própria, centralizada, para gerenciar sua operação de venda de produtos de linha Enterprise no Paraguai.

### Modelos de negócio

**B2B** — empresas paraguaias, empresas de tecnologia, integradores, revendedores, clientes corporativos.

**B2C** — consumidores finais no Paraguai que compram diretamente pelo e-commerce.

**Compras Paraguai** — canal/vitrine importante de divulgação dos produtos, integrado via feed XML.

### Composição da plataforma

```
                    DATA CENTER LA
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
       ERP                CRM             E-COMMERCE
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    CORE DA PLATAFORMA
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
      ESTOQUE          FINANCEIRO       INTEGRAÇÕES
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                      PostgreSQL
                           │
                    BACKEND EM GO
```

---

## 2. Princípio principal da arquitetura

O sistema será **modular**, mas os módulos **não serão completamente isolados**. Comunicação via regras e eventos bem definidos.

```
VENDA CONFIRMADA
       │
       ├──> Estoque valida disponibilidade
       ├──> Estoque registra saída
       ├──> Financeiro registra recebimento
       ├──> CRM atualiza histórico
       ├──> E-commerce atualiza pedido
       └──> Integrações atualizam canais externos
```

Nenhum módulo altera dados críticos de outro de forma descontrolada.

---

## 3. Tecnologias

| Camada | Tecnologia | Responsabilidades |
|--------|------------|-------------------|
| Backend | **Go** | API, regras de negócio, vendas, estoque, financeiro, integrações, auth, jobs |
| Banco | **PostgreSQL** | Banco principal |
| Frontend | **React + Next.js** (recomendado) | ERP, CRM, admin, e-commerce, catálogo público |

---

## 4. Módulos principais

| # | Módulo |
|---|--------|
| 01 | Autenticação e Segurança |
| 02 | Usuários, Roles e Permissões |
| 03 | Estrutura Organizacional |
| 04 | Cadastro Mestre |
| 05 | Produtos / PIM |
| 06 | **Estoque** |
| 07 | Compras e Fornecedores |
| 08 | Vendas |
| 09 | Cotações |
| 10 | CRM |
| 11 | Financeiro |
| 12 | E-commerce |
| 13 | Clientes B2B |
| 14 | Revendedores |
| 15 | Logística |
| 16 | Pós-venda / Garantia / RMA |
| 17 | Integrações |
| 18 | Compras Paraguai |
| 19 | Notificações |
| 20 | Relatórios |
| 21 | BI e Métricas |
| 22 | Configurações |
| 23 | Auditoria |
| 24 | Plataforma e Infraestrutura |

---

## 5. Autenticação e Segurança

Porta de entrada da plataforma.

**Funcionalidades:** cadastro, login, confirmação de e-mail, recuperação de senha, links temporários, expiração de tokens, gestão de sessões, logout, logout remoto, bloqueio de contas, política de senhas, auditoria de acesso.

**MFA (obrigatório para colaboradores internos):**

- Aplicativo autenticador
- E-mail
- SMS
- Futuro: Passkeys / WebAuthn

Clientes e-commerce: MFA opcional inicialmente.

---

## 6. Usuários, Roles e Permissões

Permissões **granulares**, não dependentes apenas do nome do cargo.

**Perfis previstos:** Administrador Geral, Administrador, Vendas, Suporte, Financeiro, Estoque, Compras, Gerência, Revendedor.

**Exemplo — Vendedor (João):**

| Pode | Não pode |
|------|----------|
| Visualizar produtos | Alterar custo |
| Consultar estoque disponível | Ajustar estoque |
| Consultar preços autorizados | Ver info financeira restrita |
| Criar clientes, cotações, pedidos | |

Operações sensíveis exigem permissões elevadas; em alguns casos, **dupla aprovação**.

---

## 7. Estrutura organizacional

```
Empresa
├── Filiais
├── Departamentos
├── Equipes
├── Cargos
├── Colaboradores
└── Revendedores
```

---

## 8. Cadastro Mestre

Base compartilhada: clientes, empresas, fornecedores, revendedores, marcas, fabricantes, categorias, unidades de medida, depósitos, localizações.

---

## 9. Clientes

**B2C:** nome, e-mail, telefone, documento, endereço, histórico de pedidos.

**B2B:** razão social, nome fantasia, identificação fiscal, contatos, responsáveis, condições comerciais, tabelas de preço, histórico comercial.

---

## 10. Revendedores

Tratamento específico: cadastro próprio, tabela de preços, condições comerciais, margens, comissões futuras, metas futuras, vendedor responsável. Portal exclusivo no futuro.

---

## 11–13. Produtos / PIM

Cadastro estruturado — não apenas nome + preço + estoque. Cada categoria possui atributos próprios.

**Exemplo — Memória RAM:**

| Atributo | Valor |
|----------|-------|
| Categoria | Memória |
| Tecnologia | DDR4 |
| Capacidade | 32 GB |
| Frequência | 3200 MHz |
| ECC | Sim |
| Tipo | RDIMM |
| Formato | DIMM |
| Fabricante | Samsung |
| Marca | Dell / HP |
| Modelo / Part Number | XXXXX |

Descrição gerada automaticamente: *Memória 32GB DDR4 3200MHz ECC RDIMM Samsung* — regras por categoria.

Mesmo modelo para HDD, SSD, placas de rede e toda linha Enterprise.

### Sistema de atributos dinâmicos

```
CATEGORIA → ATRIBUTOS → VALORES
```

Sem centenas de colunas fixas. Novas categorias sem alterar estrutura do banco.

---

## 14–16. Cadastro, SKU e Unidade

```
CADASTRO                              UNIDADE (estoque)
MEMORIA DDR4 32GB...                  AAA0001
SKU: 000042 + QR                      AAA0002 + QR
```

| Nível | Código |
|-------|--------|
| **Cadastro** | SKU numérico `000042` + descrição + QR |
| **Unidade** | Sequencial `AAA0001`, `AAA0002`… |

Detalhes: [Modelo de Identificação](./modulos/produtos/modelo-identificacao.md)

---

## 17. Etiquetas

```
Entrada → Identificação → Geração do código → Registro → Etiqueta
```

Conteúdo: código da unidade, produto, informações principais, código de barras, QR Code.

---

## 18–35. MÓDULO DE ESTOQUE — Tratamento Especial

> **Decisão arquitetural obrigatória:** o estoque é o motor transacional e de rastreabilidade de todo o ERP.

Se o estoque estiver errado, vendas, e-commerce, financeiro e integrações ficam errados.

### Princípio fundamental

```
ESTADO ATUAL = SOMA DAS MOVIMENTAÇÕES VÁLIDAS

Entrada       +10
Venda          -2
Devolução      +1
Ajuste         -1
──────────────────
Saldo           8
```

Nunca `estoque = estoque - 1` sem contexto, validação e registro.

### Tipos de movimentação

**Entrada:** compra, devolução, retorno, transferência recebida, ajuste positivo.

**Saída:** venda, transferência, avaria, perda, ajuste negativo, devolução ao fornecedor.

**Outras:** reserva, liberação de reserva, bloqueio, desbloqueio.

### Cada movimentação registra

ID, tipo, data/hora, usuário, produto, unidade física, quantidade, origem, destino, motivo, documento relacionado, observação.

### Disponível × reservado × físico

```
Físico:     10
Reservado:   3
Disponível:  7
```

### Cotação não baixa estoque

Cotação apresenta produto, quantidade, preço, condições, validade. Pode ser impressa, PDF, e-mail, WhatsApp. Reserva separada — cotação comum **não** retira disponibilidade.

### Fluxo de venda

```
Pedido → Validação → Reserva (quando aplicável) → Pagamento
→ Separação → Saída efetiva
```

### Inventário

Inventário geral, parcial, contagem cíclica, recontagem, por localização, categoria ou unidade.

```
Sistema: 10 | Físico: 8 → Divergência -2
→ Investigação → Recontagem → Aprovação → Ajuste auditado
```

### Ajustes

```
Divergência → Justificativa → Solicitação → Aprovação → Movimentação → Auditoria
```

Dupla aprovação para operações sensíveis.

### Conciliação

Responder: quanto deveria existir? Quanto existe? Divergência? Desde quando? Qual movimentação causou?

### Itens fantasmas (detecção)

- Item no sistema, não físico (e vice-versa)
- Serial duplicado
- Unidade vendida ainda disponível
- Reserva sem pedido válido
- Saldo negativo
- Movimentação incompleta
- Status incompatível (ex: Vendida + Disponível = Sim → alerta)

### Estados da unidade física

Recebida, Em conferência, Disponível, Reservada, Separação, Vendida, Em trânsito, Devolvida, Em garantia, Em RMA, Avariada, Bloqueada, Baixada.

Transições controladas — não pular regras sem permissão especial:

```
DISPONÍVEL → RESERVADA → SEPARAÇÃO → VENDIDA
```

### Localização física

```
Depósito → Área → Estante → Prateleira → Posição
Exemplo: DEP01-A-03-02
```

### Auditoria

Quem, o que, quando, estado anterior/posterior, motivo, aprovador. Registros não apagados — reversão via movimentação de estorno.

### Reconstrução do saldo

Histórico de eventos → entradas → reservas → saídas → ajustes → reconstrução. Objetivo arquitetural (Event Sourcing completo não obrigatório no dia 1).

### Saúde do estoque (indicadores)

Divergências abertas, ajustes, inventário pendente, unidades sem localização, seriais duplicados, reservas antigas, saldo negativo, produtos parados, bloqueados, fantasmas.

### Alertas automáticos

Estoque abaixo do mínimo, reserva expirada, status inconsistente, saldo negativo.

### Motor de regras do estoque

Regras centralizadas, não espalhadas no código:

- `status != DISPONÍVEL` → não permitir venda
- `disponível < solicitado` → não confirmar
- Ajuste manual → exigir justificativa
- Ajuste acima do limite → exigir aprovação

### Eventos emitidos pelo estoque

Integração com vendas, CRM, e-commerce, financeiro e Compras Paraguai via eventos.

---

## 36. Compras e Fornecedores

```
Fornecedor → Compra → Pedido → Recebimento → Conferência → Entrada
```

Unidade associada a: fornecedor, compra, custo, data de aquisição, lote, garantia.

---

## 37–38. Vendas e Cotações

Vendedores via WhatsApp, e-mail, ligação, presencial. Consultar produtos, estoque, preços, criar clientes, cotações, pedidos.

**Status de cotação:** Rascunho, Enviada, Visualizada, Em negociação, Aprovada, Recusada, Expirada, Convertida em pedido.

Conversão em venda sem redigitar.

---

## 39. CRM

```
Lead → Contato → Oportunidade → Cotação → Pedido → Venda → Pós-venda
```

E-mails, ligações, conversas, visitas, observações, tarefas, follow-ups.

---

## 40–41. Financeiro e Integração Venda-Estoque-Financeiro

Contas a receber/pagar, receitas, despesas, caixa, bancos, fluxo de caixa.

**Formas de pagamento:** PIX, cartão, transferência, dinheiro.

```
PEDIDO
  ├── Estoque → Reserva/Saída
  ├── Financeiro → Pagamento/Recebimento
  └── CRM → Histórico
```

---

## 42. E-commerce

Site integrado diretamente à plataforma. Mesma base de produtos e estoque — **sem estoque separado**.

```
Cliente → Cadastro → Catálogo → Carrinho → Checkout → Pagamento
→ Pedido → Estoque → Financeiro → Logística
```

---

## 43–44. Fonte única de estoque e Compras Paraguai

```
               ESTOQUE CENTRAL
                      │
         ┌────────────┼────────────┐
         │            │            │
      ERP/Vendas  E-commerce  Compras Paraguai
```

ERP proprietário dos dados. Compras Paraguai consome via camada de mapeamento → validação → gerador de feed → XML.

Detalhes: [Integração Compras Paraguai](./integracoes/compras-paraguai.md)

---

## 45. Logística

Pedido → Separação → Conferência → Embalagem → Expedição → Entrega. Futuro: transportadoras, rastreamento.

---

## 46. Garantia e RMA

```
Unidade → Venda → Cliente → Garantia → RMA → Recebimento
→ Diagnóstico → Reparo/Troca/Devolução → Finalização
```

---

## 47. Notificações

E-mail, WhatsApp, SMS, alertas internos. Cotação enviada, pedido aprovado, pagamento confirmado, estoque baixo, reserva expirando, garantia próxima do fim.

---

## 48–49. Relatórios, Métricas e BI

**Vendas:** por período, vendedor, produto, B2B/B2C, ticket médio.

**Estoque:** saldo, entradas, saídas, divergências, giro, parados, saúde.

**Financeiro:** entradas, saídas, fluxo, margens.

**Comercial:** cotações, conversão, performance.

BI futuro: dashboards executivos.

---

## 50. Motor de regras e workflows

Camada central de regras:

- Estoque < mínimo → alerta
- Venda confirmada → processo de estoque
- Pagamento confirmado → atualizar pedido
- Reserva expirar → liberar estoque
- Preço mudar → auditoria

Workflows: cotação, pedido, estoque, RMA, aprovação de ajustes.

---

## 51. Auditoria global

Quem, o que, quando, estado anterior/posterior, motivo. Especialmente: estoque, financeiro, preços, permissões, pedidos, ajustes.

---

## 52. Integrações futuras

Compras Paraguai, gateways de pagamento, WhatsApp, e-mail, SMS, bancos, transportadoras, marketplaces, APIs de fornecedores. Credenciais de integração independentes de contas de usuário.

---

## 53. Ordem de implementação

| Etapa | Escopo |
|-------|--------|
| 1 | Arquitetura-base: Go, PostgreSQL, API, segurança, auditoria, eventos |
| 2 | Core: auth, MFA, usuários, roles, permissões, estrutura org |
| 3 | Cadastros mestre |
| 4 | Produtos: PIM, atributos, SKU, unidade física, código, etiquetas |
| 5 | **Estoque** (máxima atenção): movimentações, estados, reservas, inventário, conciliação, fantasmas, alertas |
| 6 | Compras |
| 7 | Vendas e Cotações |
| 8 | CRM |
| 9 | Financeiro |
| 10 | E-commerce |
| 11 | Compras Paraguai |
| 12 | Logística e Pós-venda |
| 13 | BI e melhorias |

---

## Conclusão

Plataforma ERP/CRM/E-commerce modular sobre PostgreSQL e Go, onde o **estoque é fonte central de verdade** para disponibilidade e rastreabilidade. Cada unidade física identificada individualmente, todas as movimentações controladas e auditadas, canais consumindo base central.

O estoque merece mais desenho, testes e cuidado antes de produção. Se nascer sólido, o restante fica simples e confiável.

**Documentos relacionados:**

- [Regras Globais](./regras-globais.md)
- [Spec Técnica — Estoque](./modulos/estoque/especificacao-tecnica.md)
