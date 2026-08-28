import Link from "next/link";
import { CATALOG_GROUPS } from "@/lib/catalog-groups";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4 md:px-6">
        <div className="lg:col-span-2">
          <p className="text-[13px] font-semibold tracking-[0.28em]">DATACENTER L.A.</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
            Hardware enterprise para datacenters, MSPs e integradores. Sourcing global, envio do Paraguai
            para toda a América Latina.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Catálogo</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/75">
            {Object.values(CATALOG_GROUPS).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/loja" className="hover:text-white">
                Toda a loja
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Empresa</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/75">
            <li>
              <Link href="/contato" className="hover:text-white">
                Solicitar cotação
              </Link>
            </li>
            <li>
              <Link href="/conta" className="hover:text-white">
                Meus pedidos
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-white">
                Carrinho
              </Link>
            </li>
            <li>
              <a
                href="https://maps.google.com/?q=Av.+Adri%C3%A1n+Jara,+Cd.+del+Este+100136,+Paraguay"
                className="hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Ciudad del Este, Paraguay
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[12px] text-white/40 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© DATACENTER L.A. Todos os direitos reservados.</p>
          <p>
            Fotos de catálogo:{" "}
            <a
              href="https://commons.wikimedia.org/"
              className="underline-offset-2 hover:text-white/70 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Wikimedia Commons
            </a>{" "}
            (CC BY / CC BY-SA)
          </p>
        </div>
      </div>
    </footer>
  );
}
