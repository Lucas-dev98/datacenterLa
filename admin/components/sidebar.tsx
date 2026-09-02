"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { adminModules, sidebarItems, type AdminModule, type NavItem } from "@/lib/modules";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

function visibleItem(item: NavItem, user: ReturnType<typeof useAuth>["user"]) {
  if (item.permission) return hasPermission(user, item.permission);
  if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
  return true;
}

function moduleVisible(mod: AdminModule, user: ReturnType<typeof useAuth>["user"]) {
  const items = mod.items.filter((item) => visibleItem(item, user));
  if (items.length === 0) return false;
  if (mod.hubHref) {
    if (mod.hubPermission && hasPermission(user, mod.hubPermission)) return true;
    if (mod.hubAnyPermission && hasAnyPermission(user, mod.hubAnyPermission)) return true;
  }
  return items.length > 0;
}

function ModuleIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export function Sidebar({
  className = "",
  onNavigate,
  id,
}: {
  className?: string;
  onNavigate?: () => void;
  id?: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function pathMatches(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isActive(item: NavItem, siblingHrefs: string[] = []) {
    const href = item.href;
    const matched =
      pathMatches(href) || (item.matchAlso?.some((p) => pathMatches(p)) ?? false);
    if (!matched) return false;
    if (pathname === href || item.matchAlso?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      // Se um irmão tem match mais específico no href principal, cede
      const longerSibling = siblingHrefs.some(
        (s) =>
          s !== href &&
          s.length > href.length &&
          (pathname === s || pathname.startsWith(`${s}/`)),
      );
      if (longerSibling && pathMatches(href) && pathname !== href) return false;
    }
    return true;
  }

  function moduleIsActive(mod: AdminModule, items: NavItem[]) {
    if (items.some((item) => isActive(item))) return true;
    if (mod.items.some((item) => isActive(item))) return true;
    if (mod.hubHref && pathMatches(mod.hubHref)) return true;
    return false;
  }

  const visibleModules = useMemo(
    () => adminModules.filter((mod) => moduleVisible(mod, user)),
    [user],
  );

  const activeModuleId = useMemo(() => {
    for (const mod of visibleModules) {
      if (moduleIsActive(mod, sidebarItems(mod).filter((i) => visibleItem(i, user)))) {
        return mod.id;
      }
    }
    return visibleModules[0]?.id ?? null;
  }, [pathname, visibleModules, user]);

  const [openId, setOpenId] = useState<string | null>(activeModuleId);

  useEffect(() => {
    if (activeModuleId) setOpenId(activeModuleId);
  }, [activeModuleId]);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <aside
      id={id}
      className={`flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 ${className}`}
    >
      <div className="border-b border-slate-800 px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          Data Center LA
        </p>
        <h1 className="text-base font-semibold tracking-tight">Admin ERP</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {visibleModules.map((mod) => {
          const items = sidebarItems(mod).filter((item) => visibleItem(item, user));
          const open = openId === mod.id;
          const active = moduleIsActive(mod, items);
          const singleLeaf =
            !mod.hubHref && items.length === 1
              ? items[0]
              : mod.hubHref && items.length === 1 && items[0].href === mod.hubHref
                ? items[0]
                : null;
          const showChildren = items.length > 0 && !singleLeaf;

          if (singleLeaf && !mod.hubHref) {
            const leafActive = isActive(singleLeaf);
            return (
              <div key={mod.id} className="mb-0.5">
                <Link
                  href={singleLeaf.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition ${
                    leafActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  {mod.icon ? <ModuleIcon path={mod.icon} /> : null}
                  <span className="truncate">{singleLeaf.label}</span>
                </Link>
              </div>
            );
          }

          return (
            <div key={mod.id} className="mb-0.5">
              {mod.hubHref && mod.id !== "inicio" ? (
                <div className="flex items-center gap-0.5">
                  <Link
                    href={mod.hubHref}
                    onClick={onNavigate}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-blue-300"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    {mod.icon ? <ModuleIcon path={mod.icon} /> : null}
                    <span className="truncate">{mod.label}</span>
                  </Link>
                  {showChildren ? (
                    <button
                      type="button"
                      aria-label={open ? `Recolher ${mod.label}` : `Expandir ${mod.label}`}
                      onClick={() => toggle(mod.id)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900 hover:text-slate-300"
                    >
                      <svg
                        className={`h-3.5 w-3.5 transition ${open ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(mod.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-blue-300"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  {mod.icon ? <ModuleIcon path={mod.icon} /> : null}
                  <span className="flex-1 truncate text-left">{mod.label}</span>
                  {showChildren ? (
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${open ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </button>
              )}

              {showChildren && open ? (
                <ul className="mb-2 ml-3 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2">
                  {items.map((item) => {
                    const siblingHrefs = items.map((i) => i.href);
                    const itemActive = isActive(item, siblingHrefs);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={`block rounded-md px-2.5 py-1.5 text-[13px] transition ${
                            itemActive
                              ? "bg-blue-600 font-medium text-white"
                              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3 text-sm">
        <p className="truncate text-sm font-medium">{user?.full_name ?? "—"}</p>
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
        {user?.roles?.length ? (
          <p className="mt-1 truncate text-[11px] text-slate-600">
            {user.roles
              .map((r) => (typeof r === "string" ? r : r.name || r.code))
              .join(", ")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className="mt-2 text-xs text-slate-500 underline hover:text-white"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
