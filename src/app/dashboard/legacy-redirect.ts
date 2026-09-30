export type LegacyDashboardSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * 旧 /dashboard 学生入口在拆分应用前只服务韩语，兼容入口统一按韩语处理。
 * 共享页面模块的旧默认导出也引用这里，避免把“默认韩语”散落在各处。
 */
export const LEGACY_DASHBOARD_APP_SLUG = "korean" as const;

const STUDY_ABROAD_SECTIONS = new Set(["universities", "documents", "visa"]);

function appendSearchParams(
  pathname: string,
  searchParams: LegacyDashboardSearchParams,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }

  const serializedQuery = query.toString();
  return serializedQuery ? `${pathname}?${serializedQuery}` : pathname;
}

export function buildLegacyDashboardTarget(
  dashboardBasePath: string,
  rest: string[],
  searchParams: LegacyDashboardSearchParams
) {
  const encodedRest = rest.map((segment) => encodeURIComponent(segment)).join("/");
  const pathname = encodedRest
    ? `${dashboardBasePath}/${encodedRest}`
    : dashboardBasePath;
  return appendSearchParams(pathname, searchParams);
}

export function buildLegacyStudentAppTarget(
  dashboardBasePath: string,
  rest: string[],
  searchParams: LegacyDashboardSearchParams,
) {
  const portalPath = dashboardBasePath.endsWith("/dashboard")
    ? dashboardBasePath.slice(0, -"/dashboard".length)
    : dashboardBasePath;
  const [section] = rest;

  if (section === "admin") {
    return buildLegacyDashboardTarget(dashboardBasePath, rest, searchParams);
  }

  if (section === "profile" || section === "settings") {
    return appendSearchParams(portalPath || "/", searchParams);
  }

  const appSlug = STUDY_ABROAD_SECTIONS.has(section) ||
    (section === "courses" && rest[1] === "service")
    ? "study-abroad"
    : LEGACY_DASHBOARD_APP_SLUG;
  const encodedRest = rest.map((segment) => encodeURIComponent(segment)).join("/");
  const appBasePath = `${portalPath}/apps/${appSlug}`;
  const pathname = encodedRest ? `${appBasePath}/${encodedRest}` : appBasePath;
  return appendSearchParams(pathname, searchParams);
}

export function buildLegacyStudentAppTargetFromRequestPath(
  dashboardBasePath: string,
  requestPath: string | null,
) {
  const portalPath = dashboardBasePath.endsWith("/dashboard")
    ? dashboardBasePath.slice(0, -"/dashboard".length)
    : dashboardBasePath;
  const legacyPrefix = `${portalPath}/dashboard`;

  if (!requestPath) return `${portalPath}/apps/${LEGACY_DASHBOARD_APP_SLUG}`;

  const requestUrl = new URL(requestPath, "https://student-app.local");
  if (
    requestUrl.pathname !== legacyPrefix &&
    !requestUrl.pathname.startsWith(`${legacyPrefix}/`)
  ) {
    return `${portalPath}/apps/${LEGACY_DASHBOARD_APP_SLUG}${requestUrl.search}`;
  }

  const suffix = requestUrl.pathname.slice(legacyPrefix.length);
  const suffixSegments = suffix.split("/").filter(Boolean);
  const firstSegment = suffixSegments[0] ?? "";
  let pathname: string;

  if (firstSegment === "profile" || firstSegment === "settings") {
    pathname = portalPath || "/";
  } else {
    const appSlug = STUDY_ABROAD_SECTIONS.has(firstSegment) ||
      (firstSegment === "courses" && suffixSegments[1] === "service")
      ? "study-abroad"
      : LEGACY_DASHBOARD_APP_SLUG;
    pathname = `${portalPath}/apps/${appSlug}${suffix}`;
  }

  return `${pathname}${requestUrl.search}`;
}
