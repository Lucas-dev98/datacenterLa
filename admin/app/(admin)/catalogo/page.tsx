"use client";

import { ModuleHub } from "@/components/module-hub";
import { useAuth } from "@/components/auth-provider";
import { adminModules } from "@/lib/modules";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

const catalogoModule = adminModules.find((m) => m.id === "catalogo")!;

function canSee(
  item: (typeof catalogoModule.items)[number],
  user: ReturnType<typeof useAuth>["user"],
) {
  if (item.permission) return hasPermission(user, item.permission);
  if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
  return true;
}

export default function CatalogoModulePage() {
  const { user } = useAuth();

  const descriptions: Record<string, string> = {
    "/cadastros": "Produto + SKU + etiqueta em um fluxo",
    "/produtos": "Consulta e edição de produtos, SKUs e preços",
    "/categorias": "Hierarquia e atributos dinâmicos",
    "/precos": "Camadas B2C, B2B e revenda",
    "/etiquetas": "Etiqueta de gaveta: descrição, QR e SKU",
    "/integracoes/compras-paraguai": "Feed XML e sincronização",
  };

  const toLink = (href: string, label: string) => ({
    href,
    label,
    description: descriptions[href] ?? "",
  });

  const dayToDay = catalogoModule.items
    .filter((item) => !item.hubOnly && canSee(item, user))
    .map((item) => toLink(item.href, item.label));

  const extras = catalogoModule.items
    .filter((item) => item.hubOnly && canSee(item, user))
    .map((item) => toLink(item.href, item.label));

  return (
    <ModuleHub
      title="Catálogo"
      description="PIM — produtos, categorias, preços e publicação nos canais."
      sections={[
        { title: "Gestão", links: dayToDay },
        ...(extras.length ? [{ title: "Ferramentas", links: extras }] : []),
      ]}
    />
  );
}
