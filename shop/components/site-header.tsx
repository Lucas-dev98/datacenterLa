"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

const MOBILE_EXTRA_NAV = [
  { href: "/", label: "Início" },
  { href: "/loja", label: "Loja" },
  { href: "/conta", label: "Pedidos" },
  { href: "/cart", label: "Carrinho" },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [grupo, setGrupo] = useState("");
  const [mounted, setMounted] = useState(false);
  const home = pathname === "/";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGrupo(params.get("grupo") ?? "");
    setQ(pathname === "/loja" ? (params.get("q") ?? "") : "");
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    let scrolledState = window.scrollY > 8;
    setScrolled(scrolledState);

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = window.scrollY > 8;
        if (next !== scrolledState) {
          scrolledState = next;
          setScrolled(next);
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
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
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (open) {
      html.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      html.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      html.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  const headerSolid = scrolled || !home || open;

  return (
    <>
      <header
        className={`sticky top-0 z-[110] border-b transition-colors ${
          headerSolid
            ? "border-white/10 bg-black"
            : "border-transparent bg-black/30 backdrop-blur-sm"
        } ${open ? "backdrop-blur-none" : headerSolid ? "backdrop-blur-md" : ""}`}
      >
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[120] focus:bg-white focus:px-3 focus:py-2 focus:text-black"
        >
          Ir para o conteúdo
        </a>
        <div className="mx-auto flex h-[var(--shop-header-h)] max-w-7xl items-center gap-3 px-4 sm:gap-4 md:px-6">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>

          <Link
            href="/"
            className="min-w-0 shrink truncate text-[12px] font-semibold tracking-[0.16em] text-white sm:text-[13px] md:text-[15px] md:tracking-[0.18em]"
            onClick={closeMenu}
          >
            DATACENTER L.A.
          </Link>

          <nav className="ml-4 hidden items-center gap-6 lg:flex xl:gap-7" aria-label="Categorias">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(pathname, grupo, item.href)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:gap-3">
            <ShopSearch initialQ={q} onNavigate={closeMenu} />
            <Link
              href="/conta"
              className="hidden h-11 items-center px-2 text-[13px] text-white/70 hover:text-white lg:inline-flex"
            >
              Pedidos
            </Link>
            <Link
              href="/cart"
              aria-label={cartCount ? `Carrinho, ${cartCount} itens` : "Carrinho"}
              className="relative flex h-11 w-11 items-center justify-center text-white/80 hover:text-white"
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
              className="hidden h-11 items-center rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-white/90 sm:inline-flex"
            >
              Cotação
            </Link>
          </div>
        </div>
      </header>

      {mounted && open
        ? createPortal(
            <div
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              className="fixed inset-0 z-[100] flex flex-col bg-black text-white lg:hidden"
            >
              {/* Espaço do header — conteúdo da página fica totalmente coberto */}
              <div className="shrink-0" style={{ height: "var(--shop-header-h)" }} aria-hidden />

              <div className="shrink-0 border-b border-white/10 px-4 py-4">
                <ShopSearch variant="mobile" initialQ={q} onNavigate={closeMenu} />
              </div>

              <nav
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                aria-label="Menu"
              >
                <p className="pt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                  Catálogo
                </p>
                {PRIMARY_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-12 items-center border-b border-white/10 text-[17px]"
                    onClick={closeMenu}
                  >
                    {item.label === "Switch" ? "Switches" : item.label}
                  </Link>
                ))}

                <p className="pt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                  Conta
                </p>
                {MOBILE_EXTRA_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-12 items-center border-b border-white/10 text-[17px] ${
                      pathname === item.href ? "text-white" : "text-white/80"
                    }`}
                    onClick={closeMenu}
                  >
                    {item.label}
                    {item.href === "/cart" && cartCount > 0 ? (
                      <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
                        {cartCount}
                      </span>
                    ) : null}
                  </Link>
                ))}

                <Link
                  href="/contato"
                  className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-white text-sm font-medium text-black"
                  onClick={closeMenu}
                >
                  Solicitar cotação
                </Link>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function navClass(pathname: string, grupo: string, href: string) {
  const active = href.startsWith("/loja?grupo=")
    ? pathname === "/loja" && grupo === new URLSearchParams(href.split("?")[1] ?? "").get("grupo")
    : pathname === href;
  return `text-[13px] tracking-wide transition ${active ? "text-white" : "text-white/65 hover:text-white"}`;
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
