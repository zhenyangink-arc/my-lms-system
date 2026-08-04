import type { ReactNode } from "react";

import DashboardRouteLayout from "@/app/dashboard/DashboardRouteLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function SpaceDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  await requireDashboardAccess(
    space === "platform" ? "platform" : "tenant",
    space === "platform" ? null : space,
  );
  return <DashboardRouteLayout>{children}</DashboardRouteLayout>;
}
