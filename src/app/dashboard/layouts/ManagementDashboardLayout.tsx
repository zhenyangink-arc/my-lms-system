import type { ReactNode } from "react";

import { getAnnouncementAccess } from "@/lib/announcements";
import { isPlatformTenantManagerRole, isValidRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { getDocumentReviewAccess } from "@/lib/document-reviews";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { getHelpCenterAccess } from "@/lib/help-center";
import { getLearningRecordAccess } from "@/lib/learning-records";
import { getStandardQuestionBankAccess } from "@/lib/question-bank";
import { getLibraryAccess } from "@/lib/resource-library";
import { getVisaManagementAccess } from "@/lib/visa-management";
import { AdminWorkspaceSidebar } from "../admin/AdminWorkspaceSidebar";
import { getAdminRoleLabel } from "../admin/admin-navigation";
import { ManagementTopbar } from "../ManagementTopbar";

export type ManagementWorkspace = "platform" | "tenant";

export async function ManagementDashboardLayout({
  children,
  workspace,
}: {
  children: ReactNode;
  workspace: ManagementWorkspace;
}) {
  const [
    conversationAccess,
    announcementAccess,
    helpAccess,
    gradeAccess,
    recordAccess,
    libraryAccess,
    documentReviewAccess,
    questionBankAccess,
    visaAccess,
    auth,
  ] = await Promise.all([
    getConversationPracticeAccess(),
    getAnnouncementAccess(),
    getHelpCenterAccess(),
    getGradeCenterAccess(),
    getLearningRecordAccess(),
    getLibraryAccess(),
    getDocumentReviewAccess(),
    getStandardQuestionBankAccess(),
    getVisaManagementAccess(),
    requireActiveUser(),
  ]);

  const navigationRole =
    auth.platformProfile?.role === "platform_super_admin"
      ? "platform_super_admin"
      : conversationAccess.role;

  if (!isValidRole(navigationRole)) {
    throw new Error("当前管理身份无效，请重新登录。");
  }

  const dashboardBasePath = getDashboardBasePath(auth.tenant?.slug);
  const userName =
    auth.profile?.full_name ||
    auth.user.user_metadata?.name ||
    auth.user.email ||
    "用户";
  const workspaceName =
    workspace === "platform"
      ? navigationRole === "platform_course_inspector"
        ? "平台课程巡检"
        : "平台管理"
      : `${auth.tenant?.name ?? "机构"}管理`;
  const managementHomePath =
    navigationRole === "platform_course_inspector"
      ? "/dashboard/courses"
      : "/dashboard/admin";

  return (
    <div
      className="app-shell flex min-h-screen flex-col"
      data-dashboard-layout={`${workspace}-management`}
      data-dashboard-ui="management"
    >
      <ManagementTopbar
        workspace={workspace}
        workspaceName={workspaceName}
        roleLabel={getAdminRoleLabel(navigationRole)}
        userName={userName}
        dashboardBasePath={dashboardBasePath}
        homePath={managementHomePath}
      />

      <div className="flex min-h-0 flex-1">
        <AdminWorkspaceSidebar
          role={navigationRole}
          workspaceLabel={workspaceName}
          canManageConversationPractice={conversationAccess.canManage}
          canAccessAnnouncements={announcementAccess.canAccess}
          canManageHelpCenter={helpAccess.canManage}
          canManageGradeCenter={gradeAccess.canManage}
          canManageLearningRecords={recordAccess.canManage}
          canManageLibrary={libraryAccess.canManage}
          canManageDocumentReviews={documentReviewAccess.canManage}
          canManageTenants={isPlatformTenantManagerRole(
            auth.platformProfile?.role
          )}
          canAccessQuestionBank={questionBankAccess.canManage}
          canManageVisas={visaAccess.canManage}
          dashboardBasePath={dashboardBasePath}
        />

        <main className="min-h-0 min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
