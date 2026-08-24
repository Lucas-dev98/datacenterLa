# Data Center LA — Documentação da Plataforma

Documentação consolidada do projeto ERP/CRM/E-commerce da Data Center LA.

## Índice

| Documento | Descrição |
|-----------|-----------|
| [Plataforma Consolidada](./plataforma-consolidada.md) | Visão geral, arquitetura, módulos e decisões tomadas |
| [Regras Globais](./regras-globais.md) | Regras comerciais, financeiras, fluxos e permissões (v1.0) |
| [Spec Técnica — Estoque](./modulos/estoque/especificacao-tecnica.md) | Schema, API, estados, reservas, eventos e testes |
| [Modelo de Identificação — Produto/SKU/Unidade](./modulos/produtos/modelo-identificacao.md) | Hex do produto, SKU por cadastro, AAA por unidade |
| [Regras Globais — Pendências](./regras-globais-pendentes.md) | Checklist histórico (supersedido por regras-globais.md) |
| [Integração Compras Paraguai](./integracoes/compras-paraguai.md) | Camada de mapeamento, feed XML e regras de sincronização |
| [Feed XML — Template](./integracoes/feed-compras-paraguai.xml) | Exemplo oficial de estrutura do feed de produtos |

## Princípio central

> O **Estoque** é o motor transacional e fonte única de verdade para disponibilidade e rastreabilidade. Todos os canais (ERP, e-commerce, Compras Paraguai) consomem essa base central.

## Ordem recomendada de implementação

1. Arquitetura-base (Go, PostgreSQL, API, segurança, auditoria, eventos)
2. Core (auth, MFA, usuários, roles, permissões, estrutura organizacional)
3. Cadastros mestre
4. Produtos / PIM
5. **Estoque** (prioridade máxima)
6. Compras → Vendas/Cotações → CRM → Financeiro → E-commerce → Compras Paraguai → Logística/Pós-venda → BI
