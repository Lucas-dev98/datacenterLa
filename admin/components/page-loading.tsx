type PageLoadingProps = {
  title?: string;
};

export function PageLoading({ title = "Carregando…" }: PageLoadingProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy="true" aria-live="polite">
      <header>
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </header>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
          ))}
        </div>
      </div>
      <p className="sr-only">{title}</p>
    </div>
  );
}
