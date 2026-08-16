export type LegacyDashboardSearchParams = Record<
  string,
  string | string[] | undefined
>;

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
    : "korean";
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

  if (!requestPath) return `${portalPath}/apps/korean`;

  const requestUrl = new URL(requestPath, "https://student-app.local");
  if (
    requestUrl.pathname !== legacyPrefix &&
    !requestUrl.pathname.startsWith(`${legacyPrefix}/`)
  ) {
    return `${portalPath}/apps/korean${requestUrl.search}`;
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
      : "korean";
    pathname = `${portalPath}/apps/${appSlug}${suffix}`;
  }

  return `${pathname}${requestUrl.search}`;
}
