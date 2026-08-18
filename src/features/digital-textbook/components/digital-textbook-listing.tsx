import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { getDigitalTextbookManagementData } from "../api/service";
import { DigitalTextbookTable } from "./digital-textbook-table";
import type { DigitalTextbookDisplayRow } from "./digital-textbook-table/columns";

export default async function DigitalTextbookListing({ studentAppId }: { studentAppId: string }) {
  const result = await getDigitalTextbookManagementData(studentAppId);
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
            (sum, node) => sum + node.items.length,
            0,
          ),
          vocabularyNodes: chapter.nodes,
          grammarNodes: chapter.grammarNodes,
        })),
      ),
    ),
  );
  const textbookCount = new Set(rows.map((row) => row.textbookId)).size;
  const versionCount = new Set(rows.map((row) => row.versionId)).size;
  const moduleCount = rows.reduce((sum, row) => sum + row.moduleCount, 0);
  const grammarCount = rows.reduce((sum, row) => sum + row.grammarCount, 0);

  return (
    <div className="space-y-6">
      {result.hasError && (
        <ManagementNotice tone="warning">
          部分教材层级或内容数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="互动教材概况"
        items={[
          { label: "教材", value: textbookCount },
          { label: "版本", value: versionCount },
          { label: "章节", value: rows.length },
          { label: "内容模块", value: moduleCount },
          { label: "词汇", value: result.totalVocabulary },
          { label: "语法", value: grammarCount },
        ]}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            教材内容层级
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            按课程、课时、教材、版本和章节查看词汇与语法模块；
            {result.canManage ? "当前账号可以维护内容。" : "当前账号为只读查看。"}
          </p>
        </div>
        <DigitalTextbookTable
          data={rows}
          canManage={result.canManage}
          canPublishChapters={result.canPublishChapters}
        />
      </section>
    </div>
  );
}
