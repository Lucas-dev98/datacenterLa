"use client";

import { ModuleHub } from "@/components/module-hub";

const links = [
  {
    href: "/cadastros",
    label: "Novo cadastro",
    description: "Produto + SKU + etiqueta em um fluxo",
  },
  {
    href: "/produtos",
    label: "Produtos / SKUs",
    description: "Consulta e edição de itens já cadastrados",
  },
  {
    href: "/etiquetas",
    label: "Etiquetas em lote",
    description: "Impressão de etiquetas de cadastro e unidade AAA",
  },
];

export default function EstoqueCadastroPage() {
  return (
    <ModuleHub
      title="Cadastro para estoque"
      description="Antes de receber ou vender, o SKU precisa existir no catálogo."
      links={links}
    />
  );
}
