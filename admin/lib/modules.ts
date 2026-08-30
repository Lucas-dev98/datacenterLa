export type NavItem = {
  href: string;
  label: string;
  description?: string;
  permission?: string;
  anyPermission?: string[];
  /** Se true, aparece no hub do módulo mas não no sidebar */
  hubOnly?: boolean;
  /** Paths extras que mantêm este item ativo (ex.: hub Pós-venda → /devolucoes) */
  matchAlso?: string[];
};

export type AdminModule = {
  id: string;
  label: string;
  /** Ícone SVG path (viewBox 0 0 24 24) */
  icon?: string;
  hubHref?: string;
  hubPermission?: string;
  hubAnyPermission?: string[];
  items: NavItem[];
};

/** Navegação modular do admin ERP — itens do sidebar = fluxo diário; detalhes no hub */
export const adminModules: AdminModule[] = [
  {
    id: "inicio",
    label: "Início",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
    items: [
      {
        href: "/",
        label: "Dashboard",
        anyPermission: ["finance.receivables.read", "sales.orders.write", "inventory.read"],
      },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    hubHref: "/catalogo",
    hubAnyPermission: ["pim.products.read", "pim.products.write", "pim.prices.read"],
    items: [
      { href: "/produtos", label: "Produtos", permission: "pim.products.read" },
      { href: "/categorias", label: "Categorias", permission: "pim.products.write" },
      { href: "/precos", label: "Preços", permission: "pim.prices.read" },
      { href: "/etiquetas", label: "Etiquetas", permission: "labels.batch" },
      {
        href: "/cadastros",
        label: "Novo cadastro",
        description: "Produto + SKU + etiqueta em um fluxo",
        permission: "pim.products.write",
        hubOnly: true,
      },
      {
        href: "/integracoes/compras-paraguai",
        label: "Compras Paraguai",
        description: "Feed XML e sincronização",
        permission: "pim.products.read",
        hubOnly: true,
      },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    hubHref: "/compras",
    hubPermission: "purchases.read",
    items: [{ href: "/compras", label: "Ordens de compra", permission: "purchases.read" }],
  },
  {
    id: "estoque",
    label: "Estoque",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    hubHref: "/estoque",
    hubPermission: "inventory.read",
    items: [
      {
        href: "/estoque/entrada",
        label: "Entrada",
        description: "Receber mercadoria — PO, inspeção e liberação",
        anyPermission: ["inventory.receive", "inventory.read"],
      },
      {
        href: "/estoque/posicao",
        label: "Posição",
        description: "Saldo por SKU — físico, reservado e disponível",
        permission: "inventory.read",
      },
      {
        href: "/estoque/saida/expedicao",
        label: "Expedição",
        description: "Separar e expedir pedidos pagos",
        anyPermission: ["sales.orders.write", "sales.orders.confirm"],
        matchAlso: ["/estoque/saida"],
      },
      {
        href: "/estoque/inventario",
        label: "Inventário",
        description: "Contagem física e ajustes",
        permission: "inventory.count",
      },
      {
        href: "/estoque/movimentacoes",
        label: "Movimentações",
        description: "Histórico de entradas, saídas e reservas",
        permission: "inventory.read",
        hubOnly: true,
      },
      {
        href: "/estoque/saude",
        label: "Saúde",
        description: "Inconsistências e reservas expirando",
        permission: "inventory.read",
        hubOnly: true,
      },
      {
        href: "/estoque/saida",
        label: "Saída",
        description: "Hub de saída, devoluções e RMA",
        anyPermission: ["inventory.read", "sales.orders.write", "sales.orders.confirm"],
        hubOnly: true,
      },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
    hubHref: "/vendas",
    hubAnyPermission: [
      "sales.quotes.write",
      "sales.orders.write",
      "sales.pos.write",
      "crm.customers.write",
      "crm.leads.write",
      "sales.rma.write",
      "sales.returns.write",
    ],
    items: [
      { href: "/pedidos", label: "Pedidos", permission: "sales.orders.write" },
      { href: "/vendas/pdv", label: "PDV", permission: "sales.pos.write" },
      { href: "/cotacoes", label: "Cotações", permission: "sales.quotes.write" },
      { href: "/clientes", label: "Clientes", permission: "crm.customers.write" },
      {
        href: "/vendas/pos-venda",
        label: "Pós-venda",
        description: "Devoluções e RMA / garantia",
        anyPermission: ["sales.returns.write", "sales.rma.write"],
        matchAlso: ["/devolucoes", "/rma"],
      },
      {
        href: "/crm/leads",
        label: "Leads CRM",
        description: "Pipeline de oportunidades",
        permission: "crm.leads.write",
        hubOnly: true,
      },
      {
        href: "/devolucoes",
        label: "Devoluções",
        description: "Retorno comercial — arrependimento e reembolso",
        permission: "sales.returns.write",
        hubOnly: true,
      },
      {
        href: "/rma",
        label: "RMA / Garantia",
        description: "Defeito técnico — teste e garantia",
        permission: "sales.rma.write",
        hubOnly: true,
      },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    hubHref: "/financeiro",
    hubPermission: "finance.receivables.read",
    items: [
      {
        href: "/financeiro",
        label: "Contas",
        permission: "finance.receivables.read",
      },
      {
        href: "/financeiro/analytics",
        label: "Analytics",
        description: "KPIs, margem e curva ABC",
        permission: "finance.receivables.read",
      },
      {
        href: "/financeiro/cotacoes",
        label: "Câmbio",
        description: "USD, guaraní, real e peso",
        permission: "finance.receivables.read",
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    items: [
      { href: "/usuarios", label: "Usuários", permission: "auth.users.manage" },
      { href: "/configuracoes/seguranca", label: "Segurança" },
    ],
  },
];

export function sidebarItems(mod: AdminModule): NavItem[] {
  return mod.items.filter((item) => !item.hubOnly);
}
