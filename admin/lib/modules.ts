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
      { href: "/etiquetas", label: "Etiquetas lote", permission: "labels.batch" },
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
      { href: "/estoque", label: "Posição", permission: "inventory.read" },
      { href: "/estoque/recebimento", label: "Recebimento", permission: "inventory.receive" },
      { href: "/estoque/saude", label: "Saúde", permission: "inventory.read" },
      { href: "/estoque/inventario", label: "Inventário", permission: "inventory.count" },
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
    ],
    items: [
      { href: "/cotacoes", label: "Cotações", permission: "sales.quotes.write" },
      { href: "/vendas/pdv", label: "PDV — Loja física", permission: "sales.pos.write" },
      { href: "/pedidos", label: "Pedidos", permission: "sales.orders.write" },
      { href: "/clientes", label: "Clientes", permission: "crm.customers.write" },
      { href: "/crm/leads", label: "Leads CRM", permission: "crm.leads.write" },
      { href: "/rma", label: "Devoluções / RMA", permission: "sales.rma.write" },
    ],
  },
  {
    id: "expedicao",
    label: "Expedição",
    hubHref: "/expedicao",
    hubPermission: "sales.orders.write",
    items: [
      {
        href: "/expedicao",
        label: "Fila de expedição",
        description: "Separar e expedir pedidos de todos os canais",
        permission: "sales.orders.write",
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
