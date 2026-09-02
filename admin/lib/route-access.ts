import { adminModules, type NavItem } from "./modules";
import { hasAnyPermission, hasPermission } from "./permissions";
import type { User } from "./types";

type RouteRule = { prefix: string; item: NavItem };

function itemAllowed(item: NavItem, user: User | null | undefined): boolean {
  if (item.permission) return hasPermission(user, item.permission);
  if (item.anyPermission) return hasAnyPermission(user, item.anyPermission);
  return true;
}

function buildRules(): RouteRule[] {
  const rules: RouteRule[] = [];
  for (const mod of adminModules) {
    for (const item of mod.items) {
      rules.push({ prefix: item.href, item });
      for (const alt of item.matchAlso ?? []) {
        rules.push({ prefix: alt, item });
      }
    }
    if (mod.hubHref) {
      rules.push({
        prefix: mod.hubHref,
        item: {
          href: mod.hubHref,
          label: mod.label,
          permission: mod.hubPermission,
          anyPermission: mod.hubAnyPermission,
        },
      });
    }
  }
  return rules.sort((a, b) => b.prefix.length - a.prefix.length);
}

const ROUTE_RULES = buildRules();

/** Whether the signed-in user may open this admin route (mirrors sidebar visibility). */
export function canAccessRoute(pathname: string, user: User | null | undefined): boolean {
  if (pathname === "/forbidden") return true;
  const match = ROUTE_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );
  if (!match) return true;
  return itemAllowed(match.item, user);
}
