import Link from "next/link";
import { Card } from "@/components/ui";

export type ModuleHubLink = {
  href: string;
  label: string;
  description: string;
};

type ModuleHubProps = {
  title: string;
  description: string;
  links: ModuleHubLink[];
};

export function ModuleHub({ title, description, links }: ModuleHubProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Módulo</p>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="group block">
            <Card className="h-full transition group-hover:border-blue-300 group-hover:shadow-md">
              <h2 className="font-semibold text-slate-900 group-hover:text-blue-700">{link.label}</h2>
              {link.description ? (
                <p className="mt-1 text-sm text-slate-600">{link.description}</p>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
