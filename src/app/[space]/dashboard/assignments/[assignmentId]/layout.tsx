import type { ReactNode } from "react";

import { AssessmentWorkspaceLayout } from "@/app/dashboard/assignments/AssessmentWorkspaceLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";

export default async function AssignmentDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ space: string; assignmentId: string }>;
}) {
  const { space, assignmentId } = await params;
  const access = await requireDashboardAccess(
    space === "platform" ? "platform" : "tenant",
    space === "platform" ? null : space,
  );
  const { data: assignment } = await access.auth.supabase
    .from("learning_assignments")
    .select("assignment_type")
    .eq("id", assignmentId)
    .maybeSingle();
  const section = assignment?.assignment_type === "exam" ? "exam" : "homework";

  return (
    <AssessmentWorkspaceLayout
      dashboardBasePath={access.dashboardBasePath}
      section={section}
    >
      {children}
    </AssessmentWorkspaceLayout>
  );
}
