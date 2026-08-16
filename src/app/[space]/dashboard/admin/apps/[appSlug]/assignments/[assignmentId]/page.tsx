import { redirect } from "next/navigation";

import AssignmentReviewPage from "@/app/dashboard/admin/assignments/[assignmentId]/page-content";
import { requireManagementAppAccess } from "@/lib/management-apps";

export default async function ManagementApplicationAssignmentRoute({
  params,
}: {
  params: Promise<{
    space: string;
    appSlug: string;
    assignmentId: string;
  }>;
}) {
  const { space, appSlug, assignmentId } = await params;
  const access = await requireManagementAppAccess(space, appSlug);
  if (
    access.scope !== "tenant" ||
    access.app.kind !== "learning" ||
    !access.capabilities.manageAssessments
  ) {
    redirect(access.appPath);
  }

  return (
    <AssignmentReviewPage
      params={Promise.resolve({ assignmentId })}
      expectedStudentAppId={access.appId}
      backHref={`${access.appPath}/assessments`}
    />
  );
}
