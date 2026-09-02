export function CartSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <ul className="divide-y divide-neutral-200 bg-white ring-1 ring-neutral-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex animate-pulse flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 max-w-xs rounded bg-neutral-200" />
              <div className="h-3 w-24 rounded bg-neutral-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-11 w-11 rounded-lg bg-neutral-100" />
              <div className="h-11 w-10 rounded bg-neutral-100" />
              <div className="h-11 w-11 rounded-lg bg-neutral-100" />
            </div>
          </li>
        ))}
      </ul>
      <div className="animate-pulse space-y-4 rounded-lg bg-white p-5 ring-1 ring-neutral-200">
        <div className="h-4 w-32 rounded bg-neutral-200" />
        <div className="h-8 w-full rounded bg-neutral-100" />
        <div className="h-11 w-full rounded-lg bg-neutral-200" />
      </div>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="mt-8 grid animate-pulse gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="h-4 w-40 rounded bg-neutral-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-neutral-100" />
              <div className="h-10 w-full rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
        <div className="h-11 w-full rounded-lg bg-neutral-200" />
      </div>
      <div className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-neutral-200">
        <div className="h-4 w-28 rounded bg-neutral-200" />
        <div className="h-16 w-full rounded bg-neutral-100" />
      </div>
    </div>
  );
}
