"use client";

import { ModuleHub } from "@/components/module-hub";
import { estoqueFlowDescriptions } from "@/lib/stock-sections";

const links = [
  {
    href: "/estoque/entrada/compras",
    label: "Receber compra (PO)",
    description: estoqueFlowDescriptions["/estoque/entrada/compras"],
  },
  {
    href: "/estoque/entrada/recebimento",
    label: "Fila de recebimento",
    description: estoqueFlowDescriptions["/estoque/entrada/recebimento"],
  },
  {
    href: "/estoque/entrada/avulsa",
    label: "Entrada avulsa",
    description: estoqueFlowDescriptions["/estoque/entrada/avulsa"],
  },
  {
    href: "/estoque/entrada/devolucoes-fornecedor",
    label: "Devoluções ao fornecedor",
    description: estoqueFlowDescriptions["/estoque/entrada/devolucoes-fornecedor"],
  },
];

export default function EstoqueEntradaPage() {
  return (
    <ModuleHub
      title="Entrada de estoque"
      description="Todo produto que entra passa pelo recebimento: inspeção → identificação → liberação para venda."
      links={links}
    />
  );
}
