import type { StorefrontContent, StorefrontPage } from "./storefront-types";
import type { CatalogProduct } from "./types";

export const DEFAULT_FEATURED_CODES = [
  "000078",
  "000077",
  "000079",
  "000082",
  "000085",
  "000006",
  "000001",
  "000076",
  "000021",
];

export const DEFAULT_PART_CODES = {
  cpu: "000076",
  ram: "000032",
  ssd: "000006",
};

export const DEFAULT_STOREFRONT_CONTENT: StorefrontContent = {
  trust: [
    { icon: "bolt", title: "Resposta rápida" },
    { icon: "globe", title: "Envios para toda a LATAM" },
    { icon: "box", title: "+10.000 produtos disponíveis" },
    { icon: "shield", title: "Garantia em todos os produtos" },
    { icon: "headset", title: "Suporte técnico especializado" },
    { icon: "refresh", title: "Equipamentos novos e refurbished" },
  ],
  pillars: [
    {
      title: "Sourcing global",
      text: "Obtemos equipamentos difíceis de encontrar, novos ou refurbished, nos maiores mercados tecnológicos.",
    },
    {
      title: "Preços competitivos",
      text: "Negociamos direto com distribuidores e atacadistas para oferecer o melhor custo.",
    },
    {
      title: "Garantia real",
      text: "Todos os equipamentos passam por revisão técnica e contam com garantia.",
    },
    {
      title: "Entrega internacional",
      text: "Enviamos do Paraguai para toda a América Latina com rapidez e segurança.",
    },
    {
      title: "Atendimento técnico",
      text: "Assessoria para escolher o servidor, storage ou switch ideal para o seu projeto.",
    },
    {
      title: "Inventário amplo",
      text: "+10.000 SKUs disponíveis sob pedido.",
    },
  ],
  steps: [
    {
      title: "Passo 1 — Você solicita a cotação",
      text: "Envie o modelo, marca ou o requisito técnico do servidor, storage ou switch.",
    },
    {
      title: "Passo 2 — Localizamos o produto",
      text: "Buscamos na nossa rede global de fornecedores para garantir disponibilidade e o melhor preço.",
    },
    {
      title: "Passo 3 — Enviamos a proposta",
      text: "Você recebe uma proposta clara com especificações, preço, prazos e condições.",
    },
    {
      title: "Passo 4 — Envio internacional",
      text: "Despachamos do Paraguai com embalagem segura e documentação completa.",
    },
    {
      title: "Passo 5 — Garantia e suporte",
      text: "Todos os equipamentos incluem garantia e acompanhamento pós-venda.",
    },
  ],
  faqs: [
    {
      q: "Trabalham com equipamentos novos e recondicionados?",
      a: "Sim. Oferecemos equipamentos novos, usados e refurbished, sempre verificados e com garantia.",
    },
    {
      q: "Fazem envios internacionais?",
      a: "Sim. Enviamos do Paraguai para toda a América Latina.",
    },
    {
      q: "Posso solicitar um produto específico que não aparece no site?",
      a: "Sim. Fazemos sourcing global para encontrar modelos específicos conforme a sua necessidade.",
    },
    {
      q: "Os produtos têm garantia?",
      a: "Todos os equipamentos têm garantia e revisão técnica antes do despacho.",
    },
    {
      q: "Atendem empresas, datacenters e MSPs?",
      a: "Sim. Trabalhamos com integradores, MSPs, datacenters e empresas de todos os portes.",
    },
  ],
};

/** Static showcase slides when catalog API is unavailable (matches Wix reference). */
export const FALLBACK_SHOWCASE_SLIDES: {
  image: string;
  brand: string;
  model: string;
  href: string;
  shortLabel: string;
}[] = [
  { image: "/brand/r740.webp", brand: "DELL PowerEdge", model: "R740", href: "/loja?grupo=servidores", shortLabel: "R740" },
  {
    image: "/products/hpe-dl380-gen10-plus.jpg",
    brand: "HPE ProLiant",
    model: "DL380 G10",
    href: "/loja?grupo=servidores",
    shortLabel: "DL380 G10",
  },
  {
    image: "/products/lenovo-sr650-v3.png",
    brand: "Lenovo ThinkSystem",
    model: "SR650 V3",
    href: "/loja?grupo=servidores",
    shortLabel: "SR650 V2/V3",
  },
  {
    image: "/products/cisco-catalyst-9300.png",
    brand: "Cisco Catalyst",
    model: "9300",
    href: "/loja?grupo=switch",
    shortLabel: "Cisco 9300",
  },
  {
    image: "/products/ssd-u2.jpg",
    brand: "SSD Enterprise",
    model: "1.92TB U.2",
    href: "/loja?grupo=componentes",
    shortLabel: "SSD 1.92TB",
  },
  {
    image: "/products/rdimm-ddr5-ecc.png",
    brand: "Memória ECC",
    model: "RDIMM DDR5",
    href: "/loja?grupo=componentes",
    shortLabel: "Memory",
  },
];

export function mergeStorefrontContent(content?: StorefrontContent): StorefrontContent {
  if (!content) return DEFAULT_STOREFRONT_CONTENT;
  return {
    trust: content.trust?.length ? content.trust : DEFAULT_STOREFRONT_CONTENT.trust,
    pillars: content.pillars?.length ? content.pillars : DEFAULT_STOREFRONT_CONTENT.pillars,
    steps: content.steps?.length ? content.steps : DEFAULT_STOREFRONT_CONTENT.steps,
    faqs: content.faqs?.length ? content.faqs : DEFAULT_STOREFRONT_CONTENT.faqs,
  };
}

export function shortProductLabel(name: string): string {
  const patterns = [
    /\bR\d{3,4}\b/i,
    /\bDL\d+\s*G\d+\b/i,
    /\bSR\d+\s*V?\d*\/?V?\d*\b/i,
    /\bCatalyst\s*\d+\b/i,
    /\b\d+\.?\d*\s*TB\b/i,
    /\bEPYC\b/i,
    /\bXeon\b/i,
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(-2).join(" ");
  return name;
}

export function productBrandLine(name: string): string {
  const brands = ["Dell", "HPE", "Lenovo", "Cisco", "Juniper", "Arista", "AMD", "Intel", "Samsung", "NetApp", "Seagate"];
  for (const brand of brands) {
    if (name.toLowerCase().includes(brand.toLowerCase())) {
      if (brand === "Dell") return "DELL PowerEdge";
      if (brand === "HPE") return "HPE ProLiant";
      if (brand === "Lenovo") return "Lenovo ThinkSystem";
      if (brand === "Cisco") return "Cisco Catalyst";
      return brand;
    }
  }
  const first = name.split(/\s+/)[0];
  return first ?? "Enterprise";
}

export function emptyStorefrontPage(): StorefrontPage {
  return {
    defaults: {
      warehouse_id: "11111111-1111-1111-1111-111111111001",
      location_id: "22222222-2222-2222-2222-222222222001",
      category_id: "55555555-5555-5555-5555-555555555001",
    },
    featured_models: [],
    featured: [],
    parts: {},
    content: DEFAULT_STOREFRONT_CONTENT,
  };
}

export function pickParts(
  products: CatalogProduct[],
): Record<string, CatalogProduct> {
  const byCode = Object.fromEntries(products.map((p) => [p.sku_code, p]));
  const parts: Record<string, CatalogProduct> = {};
  if (byCode[DEFAULT_PART_CODES.cpu]) parts.cpu = byCode[DEFAULT_PART_CODES.cpu];
  if (byCode[DEFAULT_PART_CODES.ram]) parts.ram = byCode[DEFAULT_PART_CODES.ram];
  if (byCode[DEFAULT_PART_CODES.ssd]) parts.ssd = byCode[DEFAULT_PART_CODES.ssd];
  return parts;
}
