import type { ReactNode } from "react";

import DashboardRouteLayout from "@/app/dashboard/DashboardRouteLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function TenantDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireDashboardAccess("tenant", tenantSlug);
  return <DashboardRouteLayout>{children}</DashboardRouteLayout>;
}
