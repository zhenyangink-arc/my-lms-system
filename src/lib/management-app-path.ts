import type { StudentAppSlug } from "@/lib/student-apps";

export function getManagementAppsPath(dashboardBasePath: string) {
  return `${dashboardBasePath}/admin/apps`;
}

export function getManagementAppPath(
  dashboardBasePath: string,
  appSlug: StudentAppSlug,
  suffix = "",
) {
  const basePath = `${getManagementAppsPath(dashboardBasePath)}/${appSlug}`;
  if (!suffix) return basePath;
  return `${basePath}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}
