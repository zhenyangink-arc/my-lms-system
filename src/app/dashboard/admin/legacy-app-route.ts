import "server-only";

import { redirect } from "next/navigation";

import {
  getManagementAppPath,
  getManagementAppsPath,
} from "@/lib/management-app-path";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import type { StudentAppSlug } from "@/lib/student-apps";

export function redirectLegacyManagementRoute(
  space: string,
  appSlug?: StudentAppSlug,
  section?: string,
): never {
  const dashboardBasePath = getDashboardBasePath(
    space === "platform" ? null : space,
  );
  if (!appSlug) redirect(getManagementAppsPath(dashboardBasePath));
  const appPath = getManagementAppPath(dashboardBasePath, appSlug);
  redirect(section ? `${appPath}/${section}` : appPath);
}
