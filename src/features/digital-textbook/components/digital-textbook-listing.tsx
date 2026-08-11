import { getDigitalTextbookManagementData } from "../api/service";
import { DigitalTextbookTable } from "./digital-textbook-table";
import type { DigitalTextbookDisplayRow } from "./digital-textbook-table/columns";

export default async function DigitalTextbookListing() {
  const result = await getDigitalTextbookManagementData();
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
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          部分教材层级或内容数据暂时无法完整读取，请稍后刷新重试。
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th>管理范围</th>
                <th>教材</th>
                <th>版本</th>
                <th>章节</th>
                <th>内容模块</th>
                <th>词汇</th>
                <th>语法</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>互动教材</th>
                <td>{textbookCount}</td>
                <td>{versionCount}</td>
                <td>{rows.length}</td>
                <td>{moduleCount}</td>
                <td>{result.totalVocabulary}</td>
                <td>{grammarCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--app-text)]">
            教材内容层级
          </h2>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            按课程、课时、教材、版本和章节查看词汇与语法模块；本页面当前仅展示数据。
          </p>
        </div>
        <DigitalTextbookTable data={rows} />
      </section>
    </div>
  );
}
