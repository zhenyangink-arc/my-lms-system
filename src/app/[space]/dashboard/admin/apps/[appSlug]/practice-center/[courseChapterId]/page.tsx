import { notFound } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import {
  getChapterPracticeUnitDetail,
  inspectChapterPracticeUnit,
} from "@/features/chapter-practice/api/management-service";
import { ChapterPracticeEditor } from "@/features/chapter-practice/components/chapter-practice-editor";
import { requirePlatformOwner } from "@/lib/admin";
import { isSubjectSectionEnabled } from "@/features/subjects";

export default async function ChapterPracticeEditorRoute({
  params,
}: {
  params: Promise<{
    space: string;
    appSlug: string;
    courseChapterId: string;
  }>;
}) {
  const { space, appSlug, courseChapterId } = await params;
  const [context] = await Promise.all([
    requireManagementApplicationSection(space, appSlug, "practice-center"),
    requirePlatformOwner(),
  ]);
  if (context.access.scope !== "platform" || !isSubjectSectionEnabled(appSlug, "practice-center")) notFound();

  const unit = await getChapterPracticeUnitDetail(courseChapterId);
  // 章节必须属于当前管理工作区的应用，避免在一个学科的页面里编辑另一个学科的巩固包。
  if (!unit || unit.studentAppId !== context.access.appId) notFound();
  const inspection = await inspectChapterPracticeUnit(unit.id);

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ChapterPracticeEditor unit={unit} inspection={inspection} space={space} />
    </ManagementApplicationSectionFrame>
  );
}
