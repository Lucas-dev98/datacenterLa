"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { CatalogProduct } from "@/lib/types";
import type { StorefrontContent } from "@/lib/storefront-types";
import { catalogImageUrl } from "@/lib/product-image";
import { MediaFrame } from "@/components/media-frame";

const TRUST_ICONS: Record<string, () => ReactNode> = {
  bolt: () => <BoltIcon />,
  globe: () => <GlobeIcon />,
  box: () => <BoxIcon />,
  shield: () => <ShieldIcon />,
  headset: () => <HeadsetIcon />,
  refresh: () => <RefreshIcon />,
};

type StorefrontProps = {
  content?: StorefrontContent;
  featuredModels: CatalogProduct[];
  featured: CatalogProduct[];
  partCPU?: CatalogProduct;
  partRAM?: CatalogProduct;
  partSSD?: CatalogProduct;
};

export function Storefront({ content, featuredModels, featured, partCPU, partRAM, partSSD }: StorefrontProps) {
  const trust = content?.trust ?? [];
  const pillars = content?.pillars ?? [];
  const steps = content?.steps ?? [];
  const faqs = content?.faqs ?? [];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-black text-white">
      <Hero />
      <TrustStrip trust={trust} />
      <ProductsIntro />
      <CategoryBlock
        id="servidores"
        title="Servidores"
        href="/loja?grupo=servidores"
        text="Equipamentos enterprise de marcas líderes como Dell, HPE, Lenovo e Supermicro. Opções novas, usadas e recondicionadas para implementações de alto desempenho."
        image="/brand/servers.webp"
        imageAlt="Rack de servidores Dell, HPE, Lenovo e IBM"
        reverse={false}
        imageFit="rack"
      />
      <CategoryBlock
        id="storages"
        title="Storages"
        href="/loja?grupo=storages"
        text="Equipamentos NAS, SAN e JBOD — Seagate Exos, Dell PowerVault, HPE MSA, NetApp, Synology e Lenovo. Chassis de armazenamento, não discos avulsos."
        image="/brand/storage.webp"
        imageAlt="Storages Seagate, Dell, HPE e NetApp"
        reverse
        imageFit="rack"
        rackClass="h-[min(72vh,780px)]"
      />
      <CategoryBlock
        id="switch"
        title="Switches e networking"
        href="/loja?grupo=switch"
        text="Switches L2/L3, routers, transceivers e equipamentos para redes de baixa latência. Cisco, Juniper, Arista, HPE Aruba."
        image="/brand/networking.webp"
        imageAlt="Switches Cisco Catalyst"
        reverse={false}
        imageFit="wide"
      />
      <CategoryBlock
        id="componentes"
        title="Componentes e peças"
        href="/loja?grupo=componentes"
        text="SSD e HDD enterprise, placas de rede, placas de vídeo, processadores, memórias ECC e fontes — peças para montar e expandir servidores e storages."
        image={partSSD ? catalogImageUrl(partSSD.image_url) : "/brand/servers.webp"}
        imageAlt={partSSD?.name ?? "SSD enterprise"}
        reverse
        extraImages={[
          partCPU ? { src: catalogImageUrl(partCPU.image_url), alt: partCPU.name } : null,
          partRAM ? { src: catalogImageUrl(partRAM.image_url), alt: partRAM.name } : null,
        ].filter((x): x is { src: string; alt: string } => Boolean(x))}
        imageFit="parts"
      />

      <section className="border-t border-white/10 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold md:text-4xl">Somos distribuidores especializados em infraestrutura de TI</h2>
          <p className="mt-4 max-w-3xl text-white/70">
            Conectamos a América Latina ao melhor hardware enterprise do mercado, com disponibilidade, preço e suporte.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((item) => (
              <article key={item.title} className="border-t border-white/20 pt-5">
                <h3 className="text-lg font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold">Produtos em destaque</h2>
          <p className="mt-2 text-white/65">
            Modelos mais pedidos por datacenters, MSPs e empresas de TI.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredModels.map((item) => (
              <Link
                key={item.sku_id}
                href={`/produto/${item.sku_id}`}
                className="group overflow-hidden border border-white/10 bg-black hover:border-white/30"
              >
                <MediaFrame src={catalogImageUrl(item.image_url)} alt="" ratio="4/3" dark pad={false} />
                <div className="border-t border-white/10 px-4 py-3 text-sm font-medium group-hover:underline">
                  {item.name}
                </div>
              </Link>
            ))}
          </div>
          {featured.length > 0 ? (
            <div className="mt-12">
              <p className="text-sm uppercase tracking-widest text-white/45">Disponível agora na loja</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((p) => (
                  <Link
                    key={p.sku_id}
                    href={`/produto/${p.sku_id}`}
                    className="border border-white/10 p-4 hover:border-white/40"
                  >
                    <p className="font-mono text-[11px] text-white/40">{p.sku_code}</p>
                    <p className="mt-1 font-medium">{p.name}</p>
                    <p className="mt-2 text-sm text-white/70">${p.price_usd.toFixed(2)} USD</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold">Um processo simples, rápido e seguro</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="border-l border-white/20 pl-4">
                <p className="text-xs text-white/40">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-white/65">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 md:px-6">
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-[160px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/featured.png" alt="" className="mx-auto aspect-square w-36 object-contain md:mx-0" />
          <div>
            <h2 className="text-3xl font-semibold">Perguntas frequentes</h2>
            <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {faqs.map((item, i) => (
                <li key={item.q}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 py-4 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-medium">{item.q}</span>
                    <span className="text-white/40">{openFaq === i ? "–" : "+"}</span>
                  </button>
                  {openFaq === i ? <p className="pb-4 text-sm text-white/65">{item.a}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[url('/brand/tablet-rack.jpg')] bg-cover bg-center">
        <div className="bg-black/75 px-4 py-24 md:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-semibold md:text-5xl">Pronto para atualizar sua infraestrutura?</h2>
            <p className="mt-4 text-white/75">
              Solicite sua cotação e receba atendimento personalizado da nossa equipe.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/contato" className="bg-white px-6 py-3 text-sm font-medium text-black hover:bg-white/90">
                Solicitar cotação
              </Link>
              <Link href="/loja" className="border border-white/50 px-6 py-3 text-sm font-medium hover:border-white">
                Ver a loja
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/50">Resposta em menos de 24 horas.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[640px] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/hero-aisle.webp"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[center_40%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/80" />
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-4 pb-10 pt-16 md:px-6">
        <h1 className="max-w-4xl text-center text-3xl font-semibold leading-tight md:mx-auto md:text-5xl">
          Hardware profissional para datacenters e infraestrutura de TI
        </h1>
        <div className="mt-auto grid items-end gap-8 pb-8 md:grid-cols-2">
          <div className="hidden md:block" />
          <div className="max-w-xl md:justify-self-end">
            <p className="text-base leading-relaxed text-white/90 md:text-lg">
              Distribuímos servidores, storages, switches e componentes enterprise com sourcing global,
              preços competitivos e entrega rápida em toda a América Latina.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/loja"
                className="bg-white px-6 py-2.5 text-sm font-medium text-black hover:bg-white/90"
              >
                Ver produtos
              </Link>
              <Link
                href="/contato"
                className="border border-white/80 bg-transparent px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                Solicitar cotação
              </Link>
            </div>
          </div>
        </div>
        <p className="text-center text-xs tracking-wide text-white/80 md:text-sm">
          · Sem mínimos de compra · Envios internacionais · Atendimento técnico especializado
        </p>
      </div>
    </section>
  );
}

function TrustStrip({ trust }: { trust: { icon: string; title: string }[] }) {
  return (
    <section className="bg-white text-black">
      <div className="grid md:grid-cols-3">
        <TrustCell icon={<TagIcon />} label="Sem mínimos de compra" />
        <TrustCell icon={<PlaneIcon />} label="Envios internacionais" />
        <TrustCell icon={<QaIcon />} label="Atendimento técnico especializado" />
      </div>
      <div className="grid gap-6 border-t border-black px-4 py-10 text-center text-sm font-medium sm:grid-cols-2 lg:grid-cols-3 md:px-6">
        {trust.map((item) => {
          const Icon = TRUST_ICONS[item.icon] ?? TRUST_ICONS.bolt;
          return (
            <p key={item.title} className="flex items-center justify-center gap-2">
              <Icon />
              {item.title}
            </p>
          );
        })}
      </div>
    </section>
  );
}

function TrustCell({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center border-b border-black md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

function ProductsIntro() {
  return (
    <section id="produtos" className="px-4 py-20 md:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <div>
          <p className="text-sm text-white/50">Nossos produtos</p>
          <h2 className="mt-4 border-l border-white pl-5 text-3xl font-semibold leading-tight md:text-4xl">
            Tudo o que o seu datacenter precisa em um só lugar
          </h2>
          <p className="mt-6 max-w-md text-white/70">
            Servidores, armazenamento, redes e componentes de grau empresarial, prontos para integração imediata.
          </p>
        </div>
        <div className="overflow-hidden">
          <MediaFrame
            src="/brand/tablet-rack.jpg"
            alt="Operação em rack Dell no datacenter"
            ratio="2/1"
            fit="cover"
            position="78% center"
            pad={false}
            dark
          />
        </div>
      </div>
    </section>
  );
}

function CategoryBlock({
  id,
  title,
  href,
  text,
  image,
  imageAlt,
  reverse,
  extraImages,
  imageFit = "well",
  rackClass = "h-[min(88vh,1000px)]",
}: {
  id: string;
  title: string;
  href: string;
  text: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  extraImages?: { src: string; alt: string }[];
  imageFit?: "well" | "rack" | "wide" | "parts";
  rackClass?: string;
}) {
  const tall = imageFit === "rack";
  const imageCol =
    imageFit === "rack" || imageFit === "wide" ? "md:w-[55%]" : "md:w-1/2";
  const textCol = tall ? "md:sticky md:top-28 md:w-[45%]" : imageFit === "wide" ? "md:w-[45%]" : "md:w-1/2";

  return (
    <section id={id} className="px-4 py-16 md:px-6">
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-10 md:flex-row ${reverse ? "md:flex-row-reverse" : ""} ${
          tall ? "md:items-start" : "items-center"
        }`}
      >
        <Link href={href} className={`block w-full ${imageCol}`}>
          {imageFit === "rack" ? (
            <span className={`mx-auto flex ${rackClass} w-full items-center justify-center`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={imageAlt}
                className="h-full w-auto max-w-none object-contain"
              />
            </span>
          ) : imageFit === "wide" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={imageAlt} className="mx-auto h-auto w-full object-contain" />
          ) : imageFit === "parts" ? (
            <div className="flex flex-wrap items-end justify-center gap-8 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={imageAlt}
                className="h-auto max-h-52 w-auto max-w-[min(100%,320px)] object-contain"
              />
              {extraImages?.map((part) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={part.src}
                  src={part.src}
                  alt={part.alt}
                  className="h-auto max-h-40 w-auto max-w-[min(100%,240px)] object-contain"
                />
              ))}
            </div>
          ) : (
            <MediaFrame src={image} alt={imageAlt} ratio="4/3" dark pad={false} />
          )}
        </Link>
        <div className={`w-full ${textCol} ${reverse ? "md:border-r md:pr-8" : "md:border-l md:pl-8"} border-white/40`}>
          <Link href={href} className="text-2xl font-semibold underline decoration-white/70 underline-offset-8 hover:decoration-white">
            {title}
          </Link>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">{text}</p>
          <Link href={href} className="mt-6 inline-block text-sm text-white/80 underline-offset-4 hover:text-white hover:underline">
            Ver catálogo →
          </Link>
        </div>
      </div>
    </section>
  );
}

function TagIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" stroke="#111" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1.2" fill="#111" />
    </svg>
  );
}
function PlaneIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12l18-8-4 18-5-6-5 3 1-7Z" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function QaIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="9" rx="1.5" stroke="#111" strokeWidth="1.4" />
      <rect x="10" y="11" width="12" height="9" rx="1.5" stroke="#111" strokeWidth="1.4" />
      <text x="6" y="10" fontSize="6" fill="#111" fontFamily="Arial">Q</text>
      <text x="15" y="18" fontSize="6" fill="#111" fontFamily="Arial">A</text>
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 7 12 3l9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-3Z" />
    </svg>
  );
}
function HeadsetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <rect x="2" y="12" width="4" height="7" rx="1" />
      <rect x="18" y="12" width="4" height="7" rx="1" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}
