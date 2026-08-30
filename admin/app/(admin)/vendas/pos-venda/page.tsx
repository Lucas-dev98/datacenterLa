"use client";

import { ModuleHub } from "@/components/module-hub";
import { useAuth } from "@/components/auth-provider";
import { hasPermission } from "@/lib/permissions";

export default function PosVendaPage() {
  const { user } = useAuth();

  const links = [
    {
      href: "/devolucoes",
      label: "Devoluções",
      description: "Retorno comercial — arrependimento, troca ou reembolso dentro do prazo",
      permission: "sales.returns.write",
    },
    {
      href: "/rma",
      label: "RMA / Garantia",
      description: "Defeito técnico — teste, evidências e encaminhamento",
      permission: "sales.rma.write",
    },
  ].filter((l) => hasPermission(user, l.permission));

  return (
    <ModuleHub
      title="Pós-venda"
      description="Devoluções comerciais e RMA / garantia — um lugar para o atendimento após a venda."
      links={links.map(({ href, label, description }) => ({ href, label, description }))}
    />
  );
}
