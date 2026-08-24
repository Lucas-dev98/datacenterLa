"use client";

import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Data Center LA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900">
            Catálogo
          </Link>
          <Link href="/cart" className="text-slate-600 hover:text-slate-900">
            Carrinho
          </Link>
          <Link href="/conta" className="text-slate-600 hover:text-slate-900">
            Meus pedidos
          </Link>
        </nav>
      </div>
    </header>
  );
}
