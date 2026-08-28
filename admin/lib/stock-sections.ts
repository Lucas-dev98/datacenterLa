import type { ModuleHubLink } from "@/components/module-hub";

export const estoqueFlowDescriptions: Record<string, string> = {
  "/estoque/entrada": "Receber mercadoria — compras, inspeção e liberação",
  "/estoque/entrada/compras": "Ordens de compra aguardando recebimento físico",
  "/estoque/entrada/recebimento": "Inspeção, identificação e liberação para venda",
  "/estoque/entrada/avulsa": "Entrada sem PO — unidades vão para a fila de recebimento",
  "/estoque/posicao": "Saldo por SKU — físico, reservado e disponível",
  "/estoque/movimentacoes": "Histórico de entradas, saídas, reservas e mudanças de status",
  "/estoque/unidades": "Consulta de unidade pelo código AAA",
  "/estoque/saida": "Separar pedidos e registrar saída com foto",
  "/estoque/saida/expedicao": "Fila de pedidos pagos aguardando entrega",
  "/estoque/cadastro": "Cadastrar produtos antes de movimentar estoque",
  "/estoque/inventario": "Contagem física e ajustes aprovados",
  "/estoque/saude": "Inconsistências, reservas expirando e KPIs",
};

export const estoqueHubSections: ModuleHubLink[] = [
  {
    href: "/estoque/entrada",
    label: "Entrada",
    description: estoqueFlowDescriptions["/estoque/entrada"],
  },
  {
    href: "/estoque/posicao",
    label: "Posição",
    description: estoqueFlowDescriptions["/estoque/posicao"],
  },
  {
    href: "/estoque/movimentacoes",
    label: "Movimentações",
    description: estoqueFlowDescriptions["/estoque/movimentacoes"],
  },
  {
    href: "/estoque/saida",
    label: "Saída",
    description: estoqueFlowDescriptions["/estoque/saida"],
  },
  {
    href: "/estoque/cadastro",
    label: "Cadastro",
    description: estoqueFlowDescriptions["/estoque/cadastro"],
  },
  {
    href: "/estoque/inventario",
    label: "Inventário",
    description: estoqueFlowDescriptions["/estoque/inventario"],
  },
  {
    href: "/estoque/saude",
    label: "Saúde",
    description: estoqueFlowDescriptions["/estoque/saude"],
  },
];
