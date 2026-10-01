import { notFound, redirect } from "next/navigation";

import AssignmentReviewPage from "@/app/dashboard/admin/assignments/[assignmentId]/page-content";
import { getSubjectManifest } from "@/features/subjects";
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
  // 与其他管理分区一致：批改详情从“作业与考试”或“成绩分析”进入，
  // 学科清单两者都未开放时不可访问。
  const subject = getSubjectManifest(access.app.slug);
  if (
    subject &&
    !subject.management.sections.includes("assessments") &&
    !subject.management.sections.includes("grades")
  ) {
    notFound();
  }
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
