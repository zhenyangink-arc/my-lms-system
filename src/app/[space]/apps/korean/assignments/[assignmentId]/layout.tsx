import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AssessmentWorkspaceLayout } from "@/app/dashboard/assignments/AssessmentWorkspaceLayout";
import { getAssignmentDetail } from "@/lib/assignment-detail-data";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import { getStudentAppBasePath, STUDENT_APP_IDS } from "@/lib/student-apps";

export default async function KoreanAssignmentDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ space: string; assignmentId: string }> }) {
  const { space, assignmentId } = await params;
  const access = await requireDashboardAccess("tenant", space);
  const { data: assignment } = await getAssignmentDetail(
    access.auth.supabase,
    access.tenantSlug ?? space,
    STUDENT_APP_IDS.korean,
    assignmentId,
  );
  if (!assignment) notFound();
  const section = assignment?.assignment_type === "exam" ? "exam" : "homework";

  return <AssessmentWorkspaceLayout dashboardBasePath={getStudentAppBasePath(space, "korean")} section={section}>{children}</AssessmentWorkspaceLayout>;
}
