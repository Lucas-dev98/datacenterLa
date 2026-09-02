import Link from "next/link";
import { CATALOG_GROUPS } from "@/lib/catalog-groups";

const FOOTER_SERVICES = [
  "Servidores enterprise",
  "Armazenamento SAN / NAS",
  "Switches de rede",
  "Componentes e peças",
  "Infraestrutura para datacenter",
];

const FOOTER_NAV = [
  { href: "/", label: "Início" },
  CATALOG_GROUPS.servidores,
  CATALOG_GROUPS.storages,
  { href: "/loja?grupo=switch", label: "Switches & networking" },
  CATALOG_GROUPS.componentes,
  { href: "/contato", label: "Sobre nós" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-2xl font-semibold tracking-[0.35em] md:text-3xl">D A T A C E N T E R L . A.</p>
            <h2 className="mt-6 text-lg font-medium md:text-xl">
              Distribuidor de hardware para datacenters e infraestrutura de TI
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/60">
              Distribuímos servidores, storages, switches e componentes enterprise para empresas,
              integradores e datacenters em toda a América Latina.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/70">
              {FOOTER_SERVICES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Navegação</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/75">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/contato" className="hover:text-white">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Localização</p>
            <h3 className="mt-4 text-lg font-medium">Ciudad del Este — Paraguay</h3>
            <a
              href="https://maps.google.com/?q=Av.+Adri%C3%A1n+Jara,+Cd.+del+Este+100136,+Paraguay"
              className="mt-3 block text-sm leading-relaxed text-white/65 hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              Av. Adrián Jara, Cd. del Este 100136, Paraguai
            </a>
            <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Idioma</p>
            <p className="mt-3 text-sm text-white/75">Português</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-[12px] text-white/40 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© DATACENTER L.A. — Todos os direitos reservados.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/contato" className="hover:text-white/70">
              Termos e condições
            </Link>
            <Link href="/contato" className="hover:text-white/70">
              Política de privacidade
            </Link>
            <a
              href="https://commons.wikimedia.org/"
              className="hover:text-white/70"
              target="_blank"
              rel="noreferrer"
            >
              Fotos: Wikimedia Commons
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
