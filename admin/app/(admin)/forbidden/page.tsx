"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">403</p>
        <h1 className="text-2xl font-semibold text-slate-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sua conta não tem permissão para acessar esta área. Fale com um administrador se precisar de
          acesso.
        </p>
      </header>
      <Card>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Voltar ao início
          </Link>
          <button
            type="button"
            onClick={() => history.back()}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Página anterior
          </button>
        </div>
      </Card>
    </div>
  );
}
