import { notFound } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { TeacherPracticeInsights } from "@/features/teacher-practice-insights/teacher-practice-insights";
import { isSubjectSectionEnabled } from "@/features/subjects";

export const dynamic = "force-dynamic";

export default async function TeacherPracticeInsightsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "practice-insights",
  );

  if (
    !isSubjectSectionEnabled(appSlug, "practice-insights") ||
    context.access.scope !== "tenant" ||
    context.access.role !== "teacher"
  ) {
    notFound();
  }

  return (
    <ManagementApplicationSectionFrame {...context}>
      <TeacherPracticeInsights access={context.access} />
    </ManagementApplicationSectionFrame>
  );
}
