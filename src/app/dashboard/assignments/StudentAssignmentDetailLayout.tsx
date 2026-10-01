import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AssessmentWorkspaceLayout } from "@/app/dashboard/assignments/AssessmentWorkspaceLayout";
import { getAssignmentDetail } from "@/lib/assignment-detail-data";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import {
  getStudentAppBasePath,
  STUDENT_APP_IDS,
  type StudentAppSlug,
} from "@/lib/student-apps";

/** 学生应用的作业详情布局：只显示属于该应用的作业，并按作业类型选中工作区分区。 */
export async function StudentAssignmentDetailLayout({
  children,
  space,
  assignmentId,
  appSlug,
}: {
  children: ReactNode;
  space: string;
  assignmentId: string;
  appSlug: StudentAppSlug;
}) {
  const access = await requireDashboardAccess("tenant", space);
  const { data: assignment } = await getAssignmentDetail(
    access.auth.supabase,
    access.tenantSlug ?? space,
    STUDENT_APP_IDS[appSlug],
    assignmentId,
  );
  if (!assignment) notFound();
  const section = assignment?.assignment_type === "exam" ? "exam" : "homework";

  return <AssessmentWorkspaceLayout dashboardBasePath={getStudentAppBasePath(space, appSlug)} section={section}>{children}</AssessmentWorkspaceLayout>;
}
