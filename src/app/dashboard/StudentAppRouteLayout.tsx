import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { requireDashboardAccess } from "@/lib/dashboard-access";
import { hasActiveStudentAppAccess } from "@/lib/student-app-access.server";
import {
  STUDENT_APP_IDS,
  type StudentAppSlug,
} from "@/lib/student-apps";
import DashboardRouteLayout from "./DashboardRouteLayout";

export async function StudentAppRouteLayout({
  children,
  space,
  appSlug,
}: {
  children: ReactNode;
  space: string;
  appSlug: StudentAppSlug;
}) {
  const access = await requireDashboardAccess("tenant", space);

  if (access.auth.profile?.role !== "student") {
    redirect(access.dashboardBasePath);
  }

  const tenant = access.auth.tenant;
  if (!tenant) redirect(access.dashboardBasePath);

  // 迁移部署后以租户应用开关为准；隐藏或停用的应用不能靠手输地址进入。
  // 与写入操作共用同一套判断（机构已开放且 active、报名有效且在有效期内）。
  const hasAccess = await hasActiveStudentAppAccess({
    supabase: access.auth.supabase,
    tenantId: tenant.id,
    studentId: access.auth.user.id,
    appId: STUDENT_APP_IDS[appSlug],
  });
  if (!hasAccess) notFound();

  return (
    <DashboardRouteLayout studentAppSlug={appSlug}>
      {children}
    </DashboardRouteLayout>
  );
}
