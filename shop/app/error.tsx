"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-4 py-24 md:px-6">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-white/45">Erro</p>
        <h1 className="mt-4 text-3xl font-semibold">Algo deu errado</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          Não foi possível carregar esta página. Tente novamente ou volte para a loja.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90"
          >
            Tentar novamente
          </button>
          <Link href="/loja" className="border border-white/40 px-5 py-2.5 text-sm font-medium hover:border-white">
            Ir para a loja
          </Link>
        </div>
      </div>
    </div>
  );
}
