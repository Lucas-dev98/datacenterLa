"use client";

import { ModuleHub } from "@/components/module-hub";
import { useAuth } from "@/components/auth-provider";
import { adminModules } from "@/lib/modules";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

const vendasModule = adminModules.find((m) => m.id === "vendas")!;

function canSee(
  item: (typeof vendasModule.items)[number],
  user: ReturnType<typeof useAuth>["user"],
) {
  if (item.permission) return hasPermission(user, item.permission);
  if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
  return true;
}

const descriptions: Record<string, string> = {
  "/cotacoes": "Propostas comerciais e conversão em pedido",
  "/vendas/pdv": "Venda balcão — scan, pagamento e entrega",
  "/pedidos": "Pedidos B2B, B2C e e-commerce",
  "/clientes": "Cadastro e crédito de clientes",
  "/crm/leads": "Pipeline de oportunidades",
  "/vendas/pos-venda": "Devoluções comerciais e RMA / garantia",
  "/devolucoes": "Retorno comercial — arrependimento e reembolso",
  "/rma": "Defeito técnico — teste e garantia",
};

export default function VendasModulePage() {
  const { user } = useAuth();

  const primaryHrefs = new Set([
    "/pedidos",
    "/vendas/pdv",
    "/cotacoes",
    "/clientes",
    "/vendas/pos-venda",
  ]);

  const primary = vendasModule.items
    .filter((item) => primaryHrefs.has(item.href) && canSee(item, user))
    .map((item) => ({
      href: item.href,
      label: item.label,
      description: item.description ?? descriptions[item.href] ?? "",
    }));

  const extras = vendasModule.items
    .filter((item) => item.hubOnly && item.href === "/crm/leads" && canSee(item, user))
    .map((item) => ({
      href: item.href,
      label: item.label,
      description: item.description ?? descriptions[item.href] ?? "",
    }));

  return (
    <ModuleHub
      title="Vendas"
      description="Do lead ao pedido — cotação, PDV, clientes e pós-venda."
      sections={[
        { title: "Operação", links: primary },
        ...(extras.length ? [{ title: "CRM", links: extras }] : []),
      ]}
    />
  );
}
