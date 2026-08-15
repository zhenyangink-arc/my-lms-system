import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AssessmentWorkspaceLayout } from "@/app/dashboard/assignments/AssessmentWorkspaceLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import { getStudentAppBasePath, STUDENT_APP_IDS } from "@/lib/student-apps";

export default async function KoreanAssignmentDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ space: string; assignmentId: string }> }) {
  const { space, assignmentId } = await params;
  const { auth } = await requireDashboardAccess("tenant", space);
  const { data: assignment } = await withStudentAppSchemaFallback(
    auth.supabase
      .from("learning_assignments")
      .select("assignment_type")
      .eq("id", assignmentId)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
    () =>
      auth.supabase
        .from("learning_assignments")
        .select("assignment_type")
        .eq("id", assignmentId)
        .maybeSingle(),
  );
  if (!assignment) notFound();
  const section = assignment?.assignment_type === "exam" ? "exam" : "homework";

  return <AssessmentWorkspaceLayout dashboardBasePath={getStudentAppBasePath(space, "korean")} section={section}>{children}</AssessmentWorkspaceLayout>;
}
