import type { ModuleHubSection } from "@/components/module-hub";

export const estoqueFlowDescriptions: Record<string, string> = {
  "/estoque/entrada": "Receber mercadoria — compras, inspeção e liberação",
  "/estoque/entrada/compras": "Ordens de compra aguardando recebimento físico",
  "/estoque/entrada/recebimento": "Inspeção, testes com fotos e liberação para venda",
  "/estoque/entrada/devolucoes-fornecedor": "Unidades reprovadas — devolução ao fornecedor",
  "/estoque/entrada/avulsa": "Entrada sem PO — unidades vão para a fila de recebimento",
  "/estoque/posicao": "Saldo por SKU — físico, reservado e disponível",
  "/estoque/movimentacoes": "Histórico de entradas, saídas, reservas e mudanças de status",
  "/estoque/unidades": "Consulta de unidade pelo código AAA",
  "/estoque/saida": "Separar pedidos e registrar saída com foto",
  "/estoque/saida/expedicao": "Fila de pedidos pagos aguardando entrega",
  "/estoque/inventario": "Contagem física e ajustes aprovados",
  "/estoque/saude": "Inconsistências, reservas expirando e KPIs",
};

/** Hub de estoque agrupado por processo */
export const estoqueHubSections: ModuleHubSection[] = [
  {
    title: "Fluxo diário",
    links: [
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
        href: "/estoque/saida/expedicao",
        label: "Expedição",
        description: estoqueFlowDescriptions["/estoque/saida/expedicao"],
      },
    ],
  },
  {
    title: "Controle",
    links: [
      {
        href: "/estoque/inventario",
        label: "Inventário",
        description: estoqueFlowDescriptions["/estoque/inventario"],
      },
      {
        href: "/estoque/movimentacoes",
        label: "Movimentações",
        description: estoqueFlowDescriptions["/estoque/movimentacoes"],
      },
      {
        href: "/estoque/saude",
        label: "Saúde",
        description: estoqueFlowDescriptions["/estoque/saude"],
      },
    ],
  },
];
