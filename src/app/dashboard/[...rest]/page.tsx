import { redirect } from "next/navigation";

import { requireDashboardAccess } from "@/lib/dashboard-access";
import {
  buildLegacyDashboardTarget,
  type LegacyDashboardSearchParams,
} from "../legacy-redirect";

export default async function LegacyDashboardCatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ rest: string[] }>;
  searchParams: Promise<LegacyDashboardSearchParams>;
}) {
  const [access, { rest }, resolvedSearchParams] = await Promise.all([
    requireDashboardAccess("legacy"),
    params,
    searchParams,
  ]);

  redirect(
    buildLegacyDashboardTarget(
      access.dashboardBasePath,
      rest,
      resolvedSearchParams
    )
  );
}
