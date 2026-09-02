#!/usr/bin/env python3
"""Insere cabeçalhos JSDoc nos hooks do admin (idempotente)."""
from __future__ import annotations

import re
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parents[1] / "hooks"

# Cabeçalho por arquivo: (descrição, consumidores, notas opcionais)
META: dict[str, tuple[str, str, str]] = {
    "use-api-query.ts": (
        "Primitivo de leitura: encapsula fetch assíncrono com loading, erro e refetch.",
        "Todos os hooks use-*-list, use-*-dashboard, use-*-detail",
        "data inicia como null — use `data ?? []` nas páginas.",
    ),
    "use-api-mutation.ts": (
        "Primitivo de escrita: encapsula POST/PATCH/DELETE com loading e erro.",
        "Todos os hooks use-*-mutations",
        "run() relança o erro após setError; trate com try/catch na página.",
    ),
    "use-analytics-dashboard.ts": (
        "Dashboard de analytics de vendas (período, canal, produtos).",
        "financeiro/analytics/page.tsx",
        "",
    ),
    "use-auth-mutations.ts": (
        "Cria e atualiza usuários internos (roles, ativo/inativo).",
        "usuarios/page.tsx",
        "",
    ),
    "use-category-attributes.ts": (
        "Lista atributos configurados de uma categoria PIM.",
        "categorias/[id]/page.tsx, produtos/[id]/page.tsx (via useProductDetail)",
        "",
    ),
    "use-compras-paraguai-dashboard.ts": (
        "Logs de sync e diagnóstico do feed Compras Paraguai.",
        "integracoes/compras-paraguai/page.tsx",
        "",
    ),
    "use-compras-paraguai-mutations.ts": (
        "Dispara sincronização manual do feed XML Compras Paraguai.",
        "integracoes/compras-paraguai/page.tsx",
        "Requer permissão pim.products.write.",
    ),
    "use-create-customer-return.ts": (
        "Registra devolução comercial com fotos (multipart).",
        "devolucoes/page.tsx",
        "",
    ),
    "use-create-rma.ts": (
        "Abre caso RMA com fotos de evidência do teste.",
        "rma/page.tsx",
        "",
    ),
    "use-customer-mutations.ts": (
        "Cria cliente B2B/B2C no cadastro.",
        "clientes/page.tsx",
        "",
    ),
    "use-customer-returns-list.ts": (
        "Lista devoluções de clientes; aceita termo de busca.",
        "devolucoes/page.tsx",
        "Debounce do termo fica na página (300 ms).",
    ),
    "use-customers-list.ts": (
        "Lista clientes; por padrão só ativos (activeOnly=true).",
        "clientes/page.tsx, cotacoes/nova/page.tsx",
        "",
    ),
    "use-exchange-rates-today.ts": (
        "Cotações de câmbio vigentes no dia.",
        "financeiro/cotacoes/page.tsx",
        "",
    ),
    "use-expedition-queue.ts": (
        "Pedidos prontos para expedição (fila operacional).",
        "components/expedition-queue-panel.tsx",
        "",
    ),
    "use-finance-dashboard.ts": (
        "Resumo financeiro: recebíveis, pagáveis e margens.",
        "financeiro/page.tsx",
        "",
    ),
    "use-finance-mutations.ts": (
        "Baixa títulos a receber e a pagar.",
        "financeiro/page.tsx",
        "",
    ),
    "use-intake-queue.ts": (
        "Fila de unidades em intake (recebimento → teste → estoque).",
        "estoque/entrada/recebimento/page.tsx",
        "",
    ),
    "use-inventory-lists.ts": (
        "Contagens de inventário e ajustes pendentes/aprovados.",
        "estoque/inventario/page.tsx",
        "",
    ),
    "use-inventory-unit.ts": (
        "Detalhe de unidade física por código AAA.",
        "estoque/unidades/page.tsx",
        "",
    ),
    "use-label-mutations.ts": (
        "Gera lote de etiquetas de gaveta (PDF ou HTML).",
        "etiquetas/page.tsx",
        "",
    ),
    "use-lead-mutations.ts": (
        "Cria lead e atualiza status no funil CRM.",
        "crm/leads/page.tsx",
        "",
    ),
    "use-leads-list.ts": (
        "Lista todos os leads do CRM.",
        "crm/leads/page.tsx",
        "",
    ),
    "use-order-detail.ts": (
        "Carrega pedido e cliente; expõe setOrder para atualização otimista.",
        "pedidos/[id]/page.tsx, components/ship-expedition-modal.tsx",
        "Cliente é opcional — falha silenciosa se getCustomer falhar.",
    ),
    "use-orders-list.ts": (
        "Lista pedidos com filtro opcional de status.",
        "pedidos/page.tsx",
        "",
    ),
    "use-payment-mutations.ts": (
        "Cria e confirma PaymentIntent Stripe no admin.",
        "pedidos/[id]/page.tsx",
        "UI do cartão fica em stripe-payment-form.tsx (SDK).",
    ),
    "use-pdv-bootstrap.ts": (
        "Dados iniciais do PDV: cliente balcão (walk-in) e câmbio.",
        "vendas/pdv/page.tsx",
        "Busca de produtos/clientes permanece local na página.",
    ),
    "use-pending-receive-orders.ts": (
        "Pedidos de compra com linhas pendentes de recebimento.",
        "estoque/entrada/compras/page.tsx",
        "",
    ),
    "use-pim-category-mutations.ts": (
        "CRUD de categorias e atributos PIM.",
        "categorias/page.tsx, categorias/[id]/page.tsx",
        "",
    ),
    "use-pim-list-queries.ts": (
        "Consultas de catálogo: produtos+SKUs, lista de SKUs e categorias.",
        "produtos/page.tsx, precos/page.tsx, cadastros/page.tsx, categorias/page.tsx",
        "",
    ),
    "use-pim-product-mutations.ts": (
        "Mutações de produto/SKU: editar, foto, cadastro em massa, exclusão.",
        "produtos/page.tsx, produtos/[id]/page.tsx, cadastros/page.tsx",
        "",
    ),
    "use-pos-mutations.ts": (
        "Fluxo PIX do PDV e cadastro rápido de cliente.",
        "vendas/pdv/page.tsx, components/pdv-pix-modal.tsx",
        "",
    ),
    "use-pricing-mutations.ts": (
        "Define preços USD do SKU e sincroniza câmbio.",
        "precos/page.tsx, produtos/[id]/page.tsx, financeiro/cotacoes/page.tsx",
        "",
    ),
    "use-product-detail.ts": (
        "Produto para edição: dados, 1º SKU e atributos da categoria.",
        "produtos/[id]/page.tsx",
        "",
    ),
    "use-purchase-order-detail.ts": (
        "Detalhe de pedido de compra (fornecedor, linhas, status).",
        "compras/[id]/page.tsx",
        "",
    ),
    "use-purchase-order-mutations.ts": (
        "Salva fornecedor e cria/submete pedido de compra.",
        "compras/page.tsx",
        "",
    ),
    "use-purchase-order-receive.ts": (
        "Estado da tela de recebimento de PO (mapa SKU, linhas).",
        "estoque/entrada/compras/[id]/receber/page.tsx",
        "",
    ),
    "use-purchase-receive-intake.ts": (
        "Confirma recebimento de compra com fotos de intake.",
        "estoque/entrada/compras/[id]/receber/page.tsx",
        "",
    ),
    "use-purchases-page-data.ts": (
        "Dados agregados da página de compras (fornecedores, POs, SKUs).",
        "compras/page.tsx",
        "",
    ),
    "use-quote-mutations.ts": (
        "Cria, envia e converte cotações; atualiza solicitação do site.",
        "cotacoes/nova/page.tsx, cotacoes/[id]/page.tsx, cotacoes/page.tsx",
        "",
    ),
    "use-quotes-list.ts": (
        "Lista cotações, solicitações web e detalhe de cotação.",
        "cotacoes/page.tsx, cotacoes/[id]/page.tsx",
        "",
    ),
    "use-return-step.ts": (
        "Avança workflow de devolução: approve → receive → resolve.",
        "devolucoes/page.tsx",
        "",
    ),
    "use-rma-cases-list.ts": (
        "Lista casos RMA com busca opcional.",
        "rma/page.tsx",
        "Debounce do termo fica na página (300 ms).",
    ),
    "use-rma-step.ts": (
        "Avança workflow RMA: approve → receive → resolve.",
        "rma/page.tsx",
        "",
    ),
    "use-sales-dashboard.ts": (
        "Dashboard operacional: vendas do mês, fila expedição, estoque baixo.",
        "page.tsx (home admin)",
        "",
    ),
    "use-sales-order-mutations.ts": (
        "Confirma pedido, registra pagamento, cancela.",
        "pedidos/[id]/page.tsx",
        "",
    ),
    "use-ship-order.ts": (
        "Expede pedido com fotos da embalagem.",
        "components/ship-expedition-modal.tsx",
        "",
    ),
    "use-sku-pricing-detail.ts": (
        "Preço bruto e resolução por canal (b2c, b2b, reseller).",
        "precos/page.tsx",
        "Resolve ignora canais que falharem (retorna lista parcial).",
    ),
    "use-sku-search.ts": (
        "Busca SKUs por termo; só dispara com ≥2 caracteres.",
        "etiquetas/page.tsx",
        "enabled=false enquanto termo curto — evita spam na API.",
    ),
    "use-stock-count-mutations.ts": (
        "Contagem cíclica e ajustes de inventário (criar → aprovar → aplicar).",
        "estoque/inventario/page.tsx",
        "",
    ),
    "use-stock-health-dashboard.ts": (
        "Painel de saúde: reservas órfãs, divergências, alertas.",
        "estoque/saude/page.tsx",
        "",
    ),
    "use-stock-health-mutations.ts": (
        "Executa scan de saúde e marca issue como resolvida.",
        "estoque/saude/page.tsx",
        "",
    ),
    "use-stock-intake-mutations.ts": (
        "Fluxo de intake: receber com fotos, avançar etapas, passar/falhar teste.",
        "estoque/entrada/recebimento/page.tsx, estoque/entrada/avulsa/page.tsx",
        "",
    ),
    "use-stock-movements.ts": (
        "Movimentações de estoque paginadas com filtros.",
        "estoque/movimentacoes/page.tsx",
        "",
    ),
    "use-stock-position.ts": (
        "Posição de estoque por armazém e SKUs com estoque baixo.",
        "estoque/posicao/page.tsx",
        "",
    ),
    "use-supplier-return-mutations.ts": (
        "Atualiza status de devolução ao fornecedor.",
        "estoque/entrada/devolucoes-fornecedor/page.tsx",
        "",
    ),
    "use-supplier-returns-list.ts": (
        "Lista devoluções enviadas a fornecedores.",
        "estoque/entrada/devolucoes-fornecedor/page.tsx",
        "",
    ),
    "use-users-admin.ts": (
        "Usuários internos e roles para gestão de acesso.",
        "usuarios/page.tsx",
        "",
    ),
}


def build_header(filename: str, desc: str, pages: str, notes: str) -> str:
    lines = [
        "/**",
        f" * @file {filename}",
        f" * @description {desc}",
        f" * @consumers {pages}",
    ]
    if notes:
        lines.append(f" * @remarks {notes}")
    lines.extend(
        [
            " *",
            " * @see admin/hooks/README.md — catálogo completo",
            " * @see admin/docs/API_HOOKS.md — padrão query/mutation",
            " */",
            "",
        ]
    )
    return "\n".join(lines)


def strip_existing_header(content: str) -> str:
    """Remove cabeçalho JSDoc existente após 'use client'."""
    m = re.match(r'^("use client";\n\n)(/\*\*.*?\*/\n\n)?', content, re.DOTALL)
    if not m:
        return content
    return m.group(1) + content[m.end() :]


def main() -> None:
    updated = 0
    for path in sorted(HOOKS_DIR.glob("*.ts")):
        meta = META.get(path.name)
        if not meta:
            print(f"skip (no meta): {path.name}")
            continue
        desc, pages, notes = meta
        header = build_header(path.name, desc, pages, notes)
        content = path.read_text(encoding="utf-8")
        body = strip_existing_header(content)
        if not body.startswith('"use client";'):
            print(f"skip (no use client): {path.name}")
            continue
        new_content = '"use client";\n\n' + header + body.removeprefix('"use client";\n\n')
        if new_content != content:
            path.write_text(new_content, encoding="utf-8")
            updated += 1
    print(f"updated {updated} hook files")


if __name__ == "__main__":
    main()
