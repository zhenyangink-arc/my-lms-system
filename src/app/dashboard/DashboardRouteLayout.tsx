import type { ReactNode } from "react";

import { getAnnouncementAccess } from "@/lib/announcements";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { normalizeMembershipTier } from "@/lib/student-permissions";
import {
  getStudentAppBasePath,
  type StudentAppSlug,
} from "@/lib/student-apps";
import { ManagementDashboardLayout } from "./layouts/ManagementDashboardLayout";
import { StudentDashboardLayout } from "./layouts/StudentDashboardLayout";

export default async function DashboardRouteLayout({
  children,
  studentAppSlug,
}: {
  children: ReactNode;
  studentAppSlug?: StudentAppSlug;
}) {
  const { user, profile, tenant } = await requireActiveUser();

  const userName =
    profile?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "用户";

  const userRole = profile?.role ?? "student";

  if (userRole === "platform_course_inspector") {
    return (
      <StudentDashboardLayout
        userName={userName}
        userRole={userRole}
        // 巡检员不是付费学生，没有真实档位；能看到所有功能是 canUseStudentFeature
        // 对这个角色的显式放行（按角色判断），不是因为"档位够高"。这里给一个中性的
        // normal 占位值即可，不应该借用 vip3 冒充最高档付费学生。
        membershipTier="normal"
        canAccessAnnouncements
        dashboardBasePath={getDashboardBasePath(null)}
      >
        {children}
      </StudentDashboardLayout>
    );
  }

  if (!tenant) {
    return (
      <ManagementDashboardLayout workspace="platform">
        {children}
      </ManagementDashboardLayout>
    );
  }

  if (userRole !== "student") {
    return (
      <ManagementDashboardLayout workspace="tenant">
        {children}
      </ManagementDashboardLayout>
    );
  }

  const membershipTier = normalizeMembershipTier(profile?.membership_tier);
  const { canAccess: canAccessAnnouncements } = await getAnnouncementAccess();
  const studentWorkspaceBasePath = studentAppSlug
    ? getStudentAppBasePath(tenant.slug, studentAppSlug)
    : getDashboardBasePath(tenant.slug);

  return (
    <StudentDashboardLayout
      studentId={user.id}
      userName={userName}
      membershipTier={membershipTier}
      canAccessAnnouncements={canAccessAnnouncements}
      dashboardBasePath={studentWorkspaceBasePath}
      studentAppSlug={studentAppSlug}
    >
      {children}
    </StudentDashboardLayout>
  );
}
