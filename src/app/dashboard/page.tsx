import { redirect } from "next/navigation";

import { requireDashboardAccess } from "@/lib/dashboard-access";
import {
  buildLegacyDashboardTarget,
  buildLegacyStudentAppTarget,
  type LegacyDashboardSearchParams,
} from "./legacy-redirect";

export default async function LegacyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<LegacyDashboardSearchParams>;
}) {
  const [access, resolvedSearchParams] = await Promise.all([
    requireDashboardAccess("legacy"),
    searchParams,
  ]);

  redirect(
    access.auth.profile?.role === "student"
      ? buildLegacyStudentAppTarget(
          access.dashboardBasePath,
          [],
          resolvedSearchParams,
        )
      : buildLegacyDashboardTarget(
          access.dashboardBasePath,
          [],
          resolvedSearchParams,
        )
  );
}
