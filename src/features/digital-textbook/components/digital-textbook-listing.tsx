import Link from "next/link";

import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { getDigitalTextbookManagementData } from "../api/service";
import { DigitalTextbookTable } from "./digital-textbook-table";
import type { DigitalTextbookDisplayRow } from "./digital-textbook-table/columns";

export default async function DigitalTextbookListing({
  studentAppId,
  chapterId,
  courseStructureRoute,
}: {
  studentAppId: string;
  chapterId?: string;
  courseStructureRoute?: string;
}) {
  const result = await getDigitalTextbookManagementData(studentAppId);
  const rows: DigitalTextbookDisplayRow[] = result.courses.flatMap((course) =>
    course.lessons.flatMap((lesson) =>
      lesson.textbooks.flatMap((textbook) =>
        textbook.chapters.filter(chapter => !chapterId || chapter.id === chapterId).map((chapter) => ({
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
      <ManagementNotice tone="warning">
        发布章节会同时发布关联章节测试，不会发布教学脚本。视频课堂还需在教学脚本中完成预览与发布；独立练习库不会随教材修改自动同步。
      </ManagementNotice>
      {result.hasError && (
        <ManagementNotice tone="warning">
          部分教材层级或内容数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="教材制作概况"
        items={[
          { label: "教材", value: textbookCount },
          { label: "版本", value: versionCount },
          { label: "章节", value: rows.length },
          { label: "内容模块", value: moduleCount },
          { label: "词汇", value: rows.reduce((sum, row) => sum + row.vocabularyCount, 0) },
          { label: "语法", value: grammarCount },
        ]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              教材章节
            </h2>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              每一行对应课程结构中的一个教学位置；在这里维护教材版本、内容模块并发布教材。
              {!result.canManage && " 当前账号为只读查看。"}
            </p>
          </div>
          {courseStructureRoute && (
            <Link href={chapterId ? `${courseStructureRoute}?chapter=${encodeURIComponent(chapterId)}` : courseStructureRoute} className="inline-flex h-9 items-center border border-[var(--border)] bg-[var(--card)] px-4 text-xs font-semibold hover:bg-[var(--surface-soft)]">
              返回课程结构
            </Link>
          )}
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
