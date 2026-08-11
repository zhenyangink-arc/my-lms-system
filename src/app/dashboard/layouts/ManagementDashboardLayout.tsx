import type { ReactNode } from "react";
import { cookies } from "next/headers";

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
import { getStudentAssignmentAccess } from "@/lib/student-assignments";
import { getVisaManagementAccess } from "@/lib/visa-management";
import { AdminWorkspaceSidebar } from "../admin/AdminWorkspaceSidebar";
import { getAdminRoleLabel } from "../admin/admin-navigation";
import { ManagementTopbar } from "../ManagementTopbar";
import { ManagementSidebarProvider } from "../ManagementSidebarProvider";

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
    studentAssignmentAccess,
    auth,
    cookieStore,
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
    getStudentAssignmentAccess(),
    requireActiveUser(),
    cookies(),
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
    <ManagementSidebarProvider defaultCollapsed={cookieStore.get("management_sidebar_collapsed")?.value === "true"}>
      <div
        className="app-shell management-shell flex min-h-svh w-full"
        data-dashboard-layout={`${workspace}-management`}
        data-dashboard-ui="management"
      >
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
          canManageStudentAssignments={studentAssignmentAccess.canManage}
          dashboardBasePath={dashboardBasePath}
        />

        <div className="management-inset flex min-h-svh min-w-0 flex-1 flex-col">
          <ManagementTopbar
            workspace={workspace}
            workspaceName={workspaceName}
            roleLabel={getAdminRoleLabel(navigationRole)}
            userName={userName}
            dashboardBasePath={dashboardBasePath}
            homePath={managementHomePath}
          />
          <main id="management-main-content" tabIndex={-1} className="management-content min-h-0 min-w-0 flex-1 scroll-mt-16">
            <div className="management-content-frame" data-dashboard-canvas="management">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ManagementSidebarProvider>
  );
}
