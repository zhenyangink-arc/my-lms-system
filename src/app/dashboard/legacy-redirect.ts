export type LegacyDashboardSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function buildLegacyDashboardTarget(
  dashboardBasePath: string,
  rest: string[],
  searchParams: LegacyDashboardSearchParams
) {
  const encodedRest = rest.map((segment) => encodeURIComponent(segment)).join("/");
  const pathname = encodedRest
    ? `${dashboardBasePath}/${encodedRest}`
    : dashboardBasePath;
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
