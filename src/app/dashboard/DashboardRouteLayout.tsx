import type { ReactNode } from "react";

import { getAnnouncementAccess } from "@/lib/announcements";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { normalizeMembershipTier } from "@/lib/student-permissions";
import { ManagementDashboardLayout } from "./layouts/ManagementDashboardLayout";
import { StudentDashboardLayout } from "./layouts/StudentDashboardLayout";

export default async function DashboardRouteLayout({
  children,
}: {
  children: ReactNode;
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
        membershipTier="vip3"
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

  return (
    <StudentDashboardLayout
      studentId={user.id}
      userName={userName}
      membershipTier={membershipTier}
      canAccessAnnouncements={canAccessAnnouncements}
      dashboardBasePath={getDashboardBasePath(tenant.slug)}
    >
      {children}
    </StudentDashboardLayout>
  );
}
