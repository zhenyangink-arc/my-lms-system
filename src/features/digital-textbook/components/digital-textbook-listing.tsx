import { CreateTeachingContentEntry } from "./create-teaching-content-entry";
import { ManagementNotice } from "@/components/layout/management-page";
import { getDigitalTextbookManagementData } from "../api/service";
import type { DigitalTextbookDisplayRow } from "./digital-textbook-table/columns";
import { TextbookStudio } from "./textbook-studio";

export default async function DigitalTextbookListing({
  studentAppId,
  chapterId,
  courseStructureRoute,
  workbenchHref,
}: {
  studentAppId: string;
  chapterId?: string;
  courseStructureRoute?: string;
  workbenchHref?: string;
}) {
  const result = await getDigitalTextbookManagementData(studentAppId);
  // A failed query is unknown inventory, not a confirmed empty chapter.
  if (result.hasError) return <ManagementNotice tone="warning">教材内容读取不完整，暂不显示数量或开放编辑。请刷新重试。</ManagementNotice>;
  const rows: DigitalTextbookDisplayRow[] = result.courses.flatMap((course) =>
    course.lessons.flatMap((lesson) =>
      lesson.textbooks.flatMap((textbook) =>
        textbook.chapters.map((chapter) => ({
          id: chapter.id,
          courseId: course.id,
          courseTitle: course.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          textbookId: textbook.id,
          textbookTitle: textbook.title,
          textbookSlug: textbook.slug,
          textbookStatus: textbook.status,
          versionId: chapter.versionId,
          versionNumber: chapter.versionNumber,
          versionStatus: chapter.versionStatus,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterNumber: chapter.number,
          chapterSlug: chapter.slug,
          chapterStatus: chapter.status,
          moduleCodes: chapter.modules.map((module) => module.code),
          moduleCount: chapter.modules.length,
          nodeCount: chapter.modules.reduce(
            (sum, module) => sum + module.nodeCount,
            0,
          ),
          vocabularyCount: chapter.nodes.reduce(
            (sum, node) => sum + node.vocabulary.length,
            0,
          ),
          grammarCount: chapter.grammarNodes.reduce(
            (sum, node) => sum + node.items.length + (node.cards?.length ?? 0),
            0,
          ),
          vocabularyNodes: chapter.nodes,
          grammarNodes: chapter.grammarNodes,
        })),
      ),
    ),
  );
  return <div className="space-y-4">
    {result.canPublishChapters && !chapterId && <CreateTeachingContentEntry studentAppId={studentAppId} />}
    {result.hasError && <ManagementNotice tone="warning">教材内容读取不完整，请刷新后再编辑。</ManagementNotice>}
    <TextbookStudio key={chapterId ?? 'default'} rows={rows} initialChapterId={chapterId}
      canManage={result.canManage && !result.hasError} canPublish={result.canPublishChapters && !result.hasError}
      workbenchHref={workbenchHref} courseStructureRoute={courseStructureRoute} />
  </div>;
}
