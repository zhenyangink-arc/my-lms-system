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
  if (context.access.scope !== "platform" || appSlug !== "korean") notFound();

  const unit = await getChapterPracticeUnitDetail(courseChapterId);
  if (!unit) notFound();
  const inspection = await inspectChapterPracticeUnit(unit.id);

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ChapterPracticeEditor unit={unit} inspection={inspection} space={space} />
    </ManagementApplicationSectionFrame>
  );
}
