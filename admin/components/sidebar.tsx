"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { adminModules, type NavItem } from "@/lib/modules";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

function visibleItem(item: NavItem, user: ReturnType<typeof useAuth>["user"]) {
  if (item.permission) return hasPermission(user, item.permission);
  if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
  return true;
}

function moduleVisible(
  mod: (typeof adminModules)[number],
  user: ReturnType<typeof useAuth>["user"],
) {
  const items = mod.items.filter((item) => visibleItem(item, user));
  if (items.length === 0) return false;
  if (mod.hubHref) {
    if (mod.hubPermission && hasPermission(user, mod.hubPermission)) return true;
    if (mod.hubAnyPermission && hasAnyPermission(user, mod.hubAnyPermission)) return true;
  }
  return items.length > 0;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-xs uppercase tracking-wider text-slate-400">Data Center LA</p>
        <h1 className="text-lg font-semibold">Admin ERP</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {adminModules.filter((mod) => moduleVisible(mod, user)).map((mod) => {
          const items = mod.items.filter((item) => visibleItem(item, user));
          const hubActive = mod.hubHref ? isActive(mod.hubHref) : false;
          const anyChildActive = items.some((item) => isActive(item.href));

          return (
            <div key={mod.id} className="mb-4">
              {mod.hubHref && mod.id !== "inicio" ? (
                <Link
                  href={mod.hubHref}
                  className={`mb-1 block rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    hubActive || anyChildActive
                      ? "text-blue-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {mod.label}
                </Link>
              ) : (
                <p className="mb-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {mod.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  if (mod.hubHref && item.href === mod.hubHref && items.length === 1) {
                    return null;
                  }
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-4 text-sm">
        <p className="truncate font-medium">{user?.full_name ?? "—"}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
        {user?.roles?.length ? (
          <p className="mt-1 truncate text-xs text-slate-500">
            {user.roles
              .map((r) => (typeof r === "string" ? r : r.name || r.code))
              .join(", ")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className="mt-3 text-xs text-slate-400 underline hover:text-white"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
