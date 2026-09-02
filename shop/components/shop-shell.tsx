import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";

export function ShopShell({ children, crumbs }: { children: ReactNode; crumbs?: Crumb[] }) {
  return (
    <div className="min-h-[70vh] bg-[var(--shop-surface)] text-[var(--shop-ink)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 md:px-6 md:py-12">
        {crumbs?.length ? <Breadcrumb items={crumbs} /> : null}
        {children}
      </div>
    </div>
  );
}
