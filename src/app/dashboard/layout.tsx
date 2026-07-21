import type { ReactNode } from "react";

import { requireActiveUser } from "@/lib/auth";
import { getAnnouncementAccess } from "@/lib/announcements";
import { normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardPermissionGate } from "./DashboardPermissionGate";
import { GlobalTopbar } from "./GlobalTopbar";
import { getDashboardBasePath } from "@/lib/dashboard-path";

export const runtime = "edge";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, profile, platformProfile, tenant } = await requireActiveUser();

  const userName =
    profile?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "用户";

  const userRole = profile?.role ?? "student";
  const roleLabel = tenant?.role === "tenant_super_admin" && platformProfile?.global_role === "tenant_super_admin"
    ? "机构负责人"
    : undefined;
  const membershipTier = normalizeMembershipTier(profile?.membership_tier);
  const { canAccess: canAccessAnnouncements } = await getAnnouncementAccess();
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <GlobalTopbar />

      <DashboardPermissionGate userRole={userRole} membershipTier={membershipTier}>
        <div className="flex min-h-0 flex-1">
          <DashboardSidebar
          userName={userName}
          userRole={userRole}
          roleLabel={roleLabel}
          membershipTier={membershipTier}
          canAccessAnnouncements={canAccessAnnouncements}
          dashboardBasePath={dashboardBasePath}
          />

          <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
        </div>
      </DashboardPermissionGate>
    </div>
  );
}
