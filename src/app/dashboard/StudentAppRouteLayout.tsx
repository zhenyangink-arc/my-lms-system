import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { requireDashboardAccess } from "@/lib/dashboard-access";
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

  const appId = STUDENT_APP_IDS[appSlug];
  const [tenantAppResult, enrollmentResult] = await Promise.all([
    access.auth.supabase
      .from("tenant_student_apps")
      .select("is_enabled,status")
      .eq("tenant_id", tenant.id)
      .eq("app_id", appId)
      .maybeSingle(),
    access.auth.supabase
      .from("student_app_enrollments")
      .select("status,starts_at,ends_at")
      .eq("tenant_id", tenant.id)
      .eq("student_id", access.auth.user.id)
      .eq("app_id", appId)
      .maybeSingle(),
  ]);
  const tenantApp = tenantAppResult.data;
  const enrollment = enrollmentResult.data;
  // 服务端授权检查必须以本次请求时间判断有效期，不参与客户端渲染状态。
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const startsAt = enrollment?.starts_at
    ? Date.parse(enrollment.starts_at)
    : null;
  const endsAt = enrollment?.ends_at ? Date.parse(enrollment.ends_at) : null;

  // 迁移部署后以租户应用开关为准；隐藏或停用的应用不能靠手输地址进入。
  if (
    tenantAppResult.error ||
    !tenantApp ||
    !tenantApp.is_enabled ||
    tenantApp.status !== "active" ||
    enrollmentResult.error ||
    !enrollment ||
    enrollment.status !== "active" ||
    (startsAt !== null && Number.isFinite(startsAt) && startsAt > now) ||
    (endsAt !== null && Number.isFinite(endsAt) && endsAt <= now)
  ) {
    notFound();
  }

  return (
    <DashboardRouteLayout studentAppSlug={appSlug}>
      {children}
    </DashboardRouteLayout>
  );
}
