import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import DashboardRouteLayout from "@/app/dashboard/DashboardRouteLayout";
import { buildLegacyStudentAppTargetFromRequestPath } from "@/app/dashboard/legacy-redirect";
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
  const access = await requireDashboardAccess(
    space === "platform" ? "platform" : "tenant",
    space === "platform" ? null : space,
  );

  if (access.auth.profile?.role === "student") {
    const requestHeaders = await headers();
    redirect(
      buildLegacyStudentAppTargetFromRequestPath(
        access.dashboardBasePath,
        requestHeaders.get("x-yuanzhi-request-path"),
      ),
    );
  }

  return <DashboardRouteLayout>{children}</DashboardRouteLayout>;
}
