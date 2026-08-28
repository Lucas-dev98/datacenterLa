"use client";

import { ModuleHub } from "@/components/module-hub";
import { estoqueFlowDescriptions } from "@/lib/stock-sections";

const links = [
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
  {
    href: "/devolucoes",
    label: "Devoluções",
    description: "Retorno comercial — arrependimento, troca ou reembolso dentro do prazo",
  },
  {
    href: "/rma",
    label: "RMA / Garantia",
    description: "Defeito técnico — teste, evidências e encaminhamento (descarte ou fabricante)",
  },
];

export default function EstoqueSaidaPage() {
  return (
    <ModuleHub
      title="Saída de estoque"
      description="Separação e entrega ao cliente — e-commerce, loja física e ERP. Fotografe cada item na expedição."
      links={links}
    />
  );
}
