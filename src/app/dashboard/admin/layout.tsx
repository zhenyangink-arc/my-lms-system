import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isValidRole } from "@/lib/admin";
import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { getAnnouncementAccess } from "@/lib/announcements";
import { getHelpCenterAccess } from "@/lib/help-center";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { getLearningRecordAccess } from "@/lib/learning-records";
import { getLibraryAccess } from "@/lib/resource-library";
import { isAssignmentManagerRole } from "@/lib/learning-assignments";
import { AdminWorkspaceSidebar } from "./AdminWorkspaceSidebar";

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const [access, announcementAccess, helpAccess, gradeAccess, recordAccess, libraryAccess] = await Promise.all([
    getConversationPracticeAccess(),
    getAnnouncementAccess(),
    getHelpCenterAccess(),
    getGradeCenterAccess(),
    getLearningRecordAccess(),
    getLibraryAccess(),
  ]);
  if (!isAssignmentManagerRole(access.role) || !isValidRole(access.role)) redirect("/dashboard");

  return (
    <div className="min-h-[calc(100vh-68px)] md:flex">
      <AdminWorkspaceSidebar
        role={access.role}
        canManageConversationPractice={access.canManage}
        canAccessAnnouncements={announcementAccess.canAccess}
        canManageHelpCenter={helpAccess.canManage}
        canManageGradeCenter={gradeAccess.canManage}
        canManageLearningRecords={recordAccess.canManage}
        canManageLibrary={libraryAccess.canManage}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
