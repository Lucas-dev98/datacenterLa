"use client";

import { ModuleHub } from "@/components/module-hub";
import { estoqueHubSections } from "@/lib/stock-sections";

export default function EstoqueHubPage() {
  return (
    <ModuleHub
      title="Estoque"
      description="Controle físico por unidade (AAA): entrada, posição, saída e cadastro de produtos."
      links={estoqueHubSections}
    />
  );
}
