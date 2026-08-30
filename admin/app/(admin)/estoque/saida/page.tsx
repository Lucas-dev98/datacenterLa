"use client";

import { ModuleHub } from "@/components/module-hub";
import { estoqueFlowDescriptions } from "@/lib/stock-sections";

export default function EstoqueSaidaPage() {
  return (
    <ModuleHub
      title="Saída de estoque"
      description="Separação e entrega ao cliente — e-commerce, loja física e ERP."
      sections={[
        {
          title: "Expedição",
          links: [
            {
              href: "/estoque/saida/expedicao",
              label: "Fila de expedição",
              description: estoqueFlowDescriptions["/estoque/saida/expedicao"],
            },
            {
              href: "/pedidos",
              label: "Pedidos",
              description: "Consultar status e reimprimir comprovantes",
            },
          ],
        },
        {
          title: "Pós-venda",
          links: [
            {
              href: "/vendas/pos-venda",
              label: "Devoluções e RMA",
              description: "Retorno comercial e garantia técnica",
            },
          ],
        },
      ]}
    />
  );
}
