"use client";

import { ModuleHub } from "@/components/module-hub";
import { useAuth } from "@/components/auth-provider";
import { adminModules } from "@/lib/modules";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

const catalogoModule = adminModules.find((m) => m.id === "catalogo")!;

export default function CatalogoModulePage() {
  const { user } = useAuth();

  const descriptions: Record<string, string> = {
    "/cadastros": "Produto + SKU + etiqueta em um fluxo",
    "/produtos": "Consulta e edição de produtos, SKUs e preços",
    "/categorias": "Hierarquia e atributos dinâmicos",
    "/precos": "Busca por código, nome ou descrição e camadas B2C/B2B",
    "/etiquetas": "Etiqueta de gaveta: descrição, QR e SKU",
    "/integracoes/compras-paraguai": "Feed XML e sincronização",
  };

  const links = catalogoModule.items
    .filter((item) => {
      if (item.permission) return hasPermission(user, item.permission);
      if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
      return true;
    })
    .map((item) => ({
      href: item.href,
      label: item.label,
      description: item.description ?? descriptions[item.href] ?? "",
    }));

  return (
    <ModuleHub
      title="Catálogo"
      description="PIM — produtos, categorias, preços e publicação nos canais."
      links={links}
    />
  );
}
