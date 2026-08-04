import type { ReactNode } from "react";

import DashboardRouteLayout from "@/app/dashboard/DashboardRouteLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function PlatformDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDashboardAccess("platform");
  return <DashboardRouteLayout>{children}</DashboardRouteLayout>;
}
