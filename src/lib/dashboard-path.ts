const PLATFORM_DASHBOARD_BASE = "/platform/dashboard";
const TENANT_DASHBOARD_PATTERN = /^\/t\/[^/]+(\/dashboard(?:\/.*)?$)/;

export function getDashboardBasePath(tenantSlug?: string | null) {
  return tenantSlug
    ? `/t/${encodeURIComponent(tenantSlug)}/dashboard`
    : PLATFORM_DASHBOARD_BASE;
}

export function normalizeDashboardPathname(pathname: string) {
  if (pathname === PLATFORM_DASHBOARD_BASE) return "/dashboard";
  if (pathname.startsWith(`${PLATFORM_DASHBOARD_BASE}/`)) {
    return pathname.slice("/platform".length);
  }

  const tenantMatch = pathname.match(TENANT_DASHBOARD_PATTERN);
  return tenantMatch?.[1] ?? pathname;
}

export function isDashboardPathname(pathname: string) {
  const normalizedPathname = normalizeDashboardPathname(pathname);
  return normalizedPathname === "/dashboard" || normalizedPathname.startsWith("/dashboard/");
}

export function scopeDashboardPath(href: string, dashboardBasePath: string) {
  if (!/^\/dashboard(?:[/?#]|$)/.test(href)) return href;
  return `${dashboardBasePath}${href.slice("/dashboard".length)}`;
}
