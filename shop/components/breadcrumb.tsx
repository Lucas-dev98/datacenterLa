import Link from "next/link";

export type Crumb = { href?: string; label: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-6 text-[13px] text-neutral-500 sm:mb-8">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-neutral-900">
            Início
          </Link>
        </li>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className="shrink-0 text-neutral-300">
                /
              </span>
              {item.href ? (
                <Link href={item.href} className="hover:text-neutral-900">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`text-neutral-900 ${last ? "max-w-[14rem] truncate sm:max-w-md md:max-w-xl" : ""}`}
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
