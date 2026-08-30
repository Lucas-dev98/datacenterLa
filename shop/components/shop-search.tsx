"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ShopSearch({
  variant = "header",
  initialQ = "",
  onNavigate,
}: {
  variant?: "header" | "mobile";
  initialQ?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  function goCatalog(term: string) {
    onNavigate?.();
    router.push(term ? `/loja?q=${encodeURIComponent(term)}` : "/loja");
  }

  function goSearch(e: FormEvent) {
    e.preventDefault();
    goCatalog(q.trim());
  }

  function clearQuery() {
    setQ("");
    inputRef.current?.focus();
  }

  const header = variant === "header";
  const inputClass = header
    ? "h-10 w-44 rounded-full border border-white/15 bg-white/5 py-0 pl-9 pr-8 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-white/40 focus:bg-white/10 xl:w-72"
    : "h-12 w-full rounded-lg border border-white/15 bg-white/5 py-0 pl-3 pr-20 text-base text-white outline-none placeholder:text-white/40 sm:text-sm";

  return (
    <div className={header ? "relative hidden lg:block" : "relative"}>
      <form onSubmit={goSearch} className="relative" role="search">
        {header ? (
          <button
            type="submit"
            aria-label="Pesquisar"
            className="absolute inset-y-0 left-0 flex w-8 items-center justify-center text-white/45 hover:text-white"
          >
            <SearchIcon />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goCatalog(q.trim());
            }
          }}
          placeholder="Buscar SKU, modelo…"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputClass}
        />
        {q ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={clearQuery}
            className={`absolute inset-y-0 flex items-center justify-center text-white/45 hover:text-white ${
              header ? "right-0 w-8" : "right-11 w-9"
            }`}
          >
            <ClearIcon />
          </button>
        ) : null}
        {header ? null : (
          <button
            type="submit"
            aria-label="Pesquisar"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/45 hover:text-white"
          >
            <SearchIcon />
          </button>
        )}
      </form>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
