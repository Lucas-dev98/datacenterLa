"use client";

import { ModuleHub } from "@/components/module-hub";
import { useAuth } from "@/components/auth-provider";
import { adminModules } from "@/lib/modules";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

const vendasModule = adminModules.find((m) => m.id === "vendas")!;

export default function VendasModulePage() {
  const { user } = useAuth();

  const links = vendasModule.items
    .filter((item) => {
      if (item.permission) return hasPermission(user, item.permission);
      if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
      return true;
    })
    .map((item) => ({
      href: item.href,
      label: item.label,
      description:
        item.description ??
        ({
          "/cotacoes": "Propostas comerciais e conversão em pedido",
          "/vendas/pdv": "Venda balcão — scan, pagamento e entrega",
          "/pedidos": "Pedidos B2B, B2C e e-commerce",
          "/clientes": "Cadastro e crédito de clientes",
          "/crm/leads": "Pipeline de oportunidades",
          "/rma": "Devoluções e garantia",
        }[item.href] ?? ""),
    }));

  return (
    <ModuleHub
      title="Vendas"
      description="Cotações, pedidos, clientes e pós-venda — do lead ao pedido confirmado."
      links={links}
    />
  );
}
