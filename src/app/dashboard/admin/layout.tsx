import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isPlatformTenantManagerRole, isValidRole } from "@/lib/admin";
import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { getAnnouncementAccess } from "@/lib/announcements";
import { getHelpCenterAccess } from "@/lib/help-center";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { getLearningRecordAccess } from "@/lib/learning-records";
import { getLibraryAccess } from "@/lib/resource-library";
import { isAssignmentManagerRole } from "@/lib/learning-assignments";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { AdminWorkspaceSidebar } from "./AdminWorkspaceSidebar";

export const runtime = "edge";

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const [access, announcementAccess, helpAccess, gradeAccess, recordAccess, libraryAccess, auth] = await Promise.all([
    getConversationPracticeAccess(),
    getAnnouncementAccess(),
    getHelpCenterAccess(),
    getGradeCenterAccess(),
    getLearningRecordAccess(),
    getLibraryAccess(),
    requireActiveUser(),
  ]);
  const navigationRole = auth.platformProfile?.role === "platform_super_admin" ? "platform_super_admin" : access.role;
  if ((!isAssignmentManagerRole(access.role) && !isPlatformTenantManagerRole(navigationRole)) || !isValidRole(navigationRole)) redirect("/dashboard");

  return (
    <div className="min-h-[calc(100vh-68px)] md:flex">
      <AdminWorkspaceSidebar
        role={navigationRole}
        canManageConversationPractice={access.canManage}
        canAccessAnnouncements={announcementAccess.canAccess}
        canManageHelpCenter={helpAccess.canManage}
        canManageGradeCenter={gradeAccess.canManage}
        canManageLearningRecords={recordAccess.canManage}
        canManageLibrary={libraryAccess.canManage}
        canManageTenants={isPlatformTenantManagerRole(auth.platformProfile?.role)}
        dashboardBasePath={getDashboardBasePath(auth.tenant?.slug)}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
