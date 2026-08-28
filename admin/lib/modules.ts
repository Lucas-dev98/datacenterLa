export type NavItem = {
  href: string;
  label: string;
  description?: string;
  permission?: string;
  anyPermission?: string[];
};

export type AdminModule = {
  id: string;
  label: string;
  hubHref?: string;
  hubPermission?: string;
  hubAnyPermission?: string[];
  items: NavItem[];
};

/** Navegação modular do admin ERP */
export const adminModules: AdminModule[] = [
  {
    id: "inicio",
    label: "Início",
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
    hubHref: "/catalogo",
    hubAnyPermission: ["pim.products.read", "pim.products.write", "pim.prices.read"],
    items: [
      { href: "/cadastros", label: "Novo cadastro", permission: "pim.products.write" },
      { href: "/produtos", label: "Produtos / SKUs", permission: "pim.products.read" },
      { href: "/categorias", label: "Categorias", permission: "pim.products.write" },
      { href: "/precos", label: "Preços", permission: "pim.prices.read" },
      { href: "/etiquetas", label: "Etiquetas de gaveta", permission: "labels.batch" },
      {
        href: "/integracoes/compras-paraguai",
        label: "Compras Paraguai",
        permission: "pim.products.read",
      },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    hubHref: "/compras",
    hubPermission: "purchases.read",
    items: [{ href: "/compras", label: "Ordens de compra", permission: "purchases.read" }],
  },
  {
    id: "estoque",
    label: "Estoque",
    hubHref: "/estoque",
    hubPermission: "inventory.read",
    items: [
      { href: "/estoque/entrada", label: "Entrada", anyPermission: ["inventory.receive", "inventory.read"] },
      { href: "/estoque/posicao", label: "Posição", permission: "inventory.read" },
      { href: "/estoque/movimentacoes", label: "Movimentações", permission: "inventory.read" },
      { href: "/estoque/saida", label: "Saída", anyPermission: ["inventory.read", "sales.orders.write", "sales.orders.confirm"] },
      { href: "/estoque/cadastro", label: "Cadastro", anyPermission: ["inventory.read", "pim.products.read"] },
      { href: "/estoque/inventario", label: "Inventário", permission: "inventory.count" },
      { href: "/estoque/saude", label: "Saúde", permission: "inventory.read" },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
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
      { href: "/cotacoes", label: "Cotações", permission: "sales.quotes.write" },
      { href: "/vendas/pdv", label: "PDV — Loja física", permission: "sales.pos.write" },
      { href: "/pedidos", label: "Pedidos", permission: "sales.orders.write" },
      { href: "/clientes", label: "Clientes", permission: "crm.customers.write" },
      { href: "/crm/leads", label: "Leads CRM", permission: "crm.leads.write" },
      { href: "/devolucoes", label: "Devoluções", permission: "sales.returns.write" },
      { href: "/rma", label: "RMA / Garantia", permission: "sales.rma.write" },
    ],
  },
  {
    id: "expedicao",
    label: "Expedição",
    hubHref: "/estoque/saida/expedicao",
    hubAnyPermission: ["sales.orders.write", "sales.orders.confirm"],
    items: [
      {
        href: "/estoque/saida/expedicao",
        label: "Fila de expedição",
        description: "Separar e expedir pedidos de todos os canais",
        permission: "sales.orders.confirm",
      },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    hubHref: "/financeiro",
    hubPermission: "finance.receivables.read",
    items: [
      {
        href: "/financeiro",
        label: "Contas e margens",
        permission: "finance.receivables.read",
      },
      {
        href: "/financeiro/analytics",
        label: "KPIs e Curva ABC",
        description: "Ranking de produtos, margem e classificação Pareto",
        permission: "finance.receivables.read",
      },
      {
        href: "/financeiro/cotacoes",
        label: "Cotações do dia",
        description: "USD, guaraní, real e peso — automático",
        permission: "finance.receivables.read",
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/usuarios", label: "Usuários", permission: "auth.users.manage" },
      { href: "/configuracoes/seguranca", label: "Segurança MFA" },
    ],
  },
];
