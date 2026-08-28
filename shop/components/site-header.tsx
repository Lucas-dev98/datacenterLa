"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShopSearch } from "@/components/shop-search";
import { fetchCart } from "@/lib/api";
import { CART_EVENT } from "@/lib/cart-events";
import { CATALOG_GROUPS } from "@/lib/catalog-groups";
import { getSessionId } from "@/lib/session";

const PRIMARY_NAV = [
  CATALOG_GROUPS.servidores,
  CATALOG_GROUPS.storages,
  CATALOG_GROUPS.switch,
  CATALOG_GROUPS.componentes,
];

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [grupo, setGrupo] = useState("");
  const home = pathname === "/";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGrupo(params.get("grupo") ?? "");
    setQ(pathname === "/loja" ? (params.get("q") ?? "") : "");
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function loadCount() {
      const session = getSessionId();
      if (!session) return;
      void fetchCart(session)
        .then((cart) => setCartCount(cart.items.reduce((n, i) => n + i.quantity, 0)))
        .catch(() => {});
    }
    loadCount();
    window.addEventListener(CART_EVENT, loadCount);
    return () => window.removeEventListener(CART_EVENT, loadCount);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <HeaderChrome
      pathname={pathname}
      grupo={grupo}
      cartCount={cartCount}
      opaque={scrolled || !home || open}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      q={q}
      onNavigate={() => setOpen(false)}
    />
  );
}

function HeaderChrome({
  pathname,
  grupo,
  cartCount,
  opaque,
  open = false,
  onToggle,
  q = "",
  onNavigate,
}: {
  pathname: string;
  grupo: string;
  cartCount: number;
  opaque: boolean;
  open?: boolean;
  onToggle?: () => void;
  q?: string;
  onNavigate?: () => void;
}) {
  function navClass(href: string) {
    const active = href.startsWith("/loja?grupo=")
      ? pathname === "/loja" && grupo === new URLSearchParams(href.split("?")[1] ?? "").get("grupo")
      : pathname === href;
    return `text-[13px] tracking-wide transition ${active ? "text-white" : "text-white/65 hover:text-white"}`;
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        opaque
          ? "border-white/10 bg-black/95 backdrop-blur-md"
          : "border-transparent bg-black/30 backdrop-blur-sm"
      }`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      >
        Ir para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:h-[4.25rem] md:px-6">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center text-white lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={onToggle}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <Link href="/" className="shrink-0 text-[13px] font-semibold tracking-[0.18em] text-white md:text-[15px]">
          DATACENTER L.A.
        </Link>

        <nav className="ml-6 hidden items-center gap-7 lg:flex" aria-label="Categorias">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <ShopSearch initialQ={q} onNavigate={onNavigate} />
          <Link
            href="/conta"
            className="hidden h-10 items-center px-2 text-[13px] text-white/70 hover:text-white lg:inline-flex"
          >
            Pedidos
          </Link>
          <Link
            href="/cart"
            aria-label={cartCount ? `Carrinho, ${cartCount} itens` : "Carrinho"}
            className="relative flex h-10 w-10 items-center justify-center text-white/80 hover:text-white"
          >
            <BagIcon />
            {cartCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-black">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/contato"
            className="hidden h-10 items-center rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-white/90 sm:inline-flex"
          >
            Cotação
          </Link>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-black lg:hidden">
          <div className="border-b border-white/10 px-4 py-4">
            <ShopSearch variant="mobile" initialQ={q} onNavigate={onNavigate} />
          </div>
          <nav className="flex flex-col px-4 py-4 text-lg" aria-label="Menu">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="border-b border-white/10 py-3.5">
                {item.label}
              </Link>
            ))}
            <Link href="/conta" className="border-b border-white/10 py-3.5 text-white/70">
              Pedidos
            </Link>
            <Link href="/cart" className="border-b border-white/10 py-3.5 text-white/70">
              Carrinho
            </Link>
            <Link href="/contato" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
              Solicitar cotação
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
