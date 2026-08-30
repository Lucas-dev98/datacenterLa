import Link from "next/link";
import { Card } from "@/components/ui";

export type ModuleHubLink = {
  href: string;
  label: string;
  description: string;
};

export type ModuleHubSection = {
  title?: string;
  links: ModuleHubLink[];
};

type ModuleHubProps = {
  title: string;
  description: string;
  /** Lista plana (compatível) ou seções agrupadas por processo */
  links?: ModuleHubLink[];
  sections?: ModuleHubSection[];
};

export function ModuleHub({ title, description, links, sections }: ModuleHubProps) {
  const groups: ModuleHubSection[] =
    sections && sections.length > 0
      ? sections
      : [{ links: links ?? [] }];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Módulo</p>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>

      {groups.map((group, idx) => (
        <div key={group.title ?? `group-${idx}`} className="space-y-3">
          {group.title ? (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </h2>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {group.links.map((link) => (
              <Link key={link.href} href={link.href} className="group block">
                <Card className="h-full border-slate-200/80 transition group-hover:border-blue-300 group-hover:shadow-md">
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">
                    {link.label}
                  </h3>
                  {link.description ? (
                    <p className="mt-1 text-sm leading-snug text-slate-600">{link.description}</p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
