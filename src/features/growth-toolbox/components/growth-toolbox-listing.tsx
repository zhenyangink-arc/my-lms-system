import { getGrowthToolboxManagementData } from "../api/service";
import { GrowthToolboxGrammarTable } from "./grammar-table";
import { GrowthToolboxItemsTable } from "./toolbox-items-table";
import type { GrowthToolboxItemDisplayRow } from "./toolbox-items-table/columns";
import { GrowthToolboxVocabularyTable } from "./vocabulary-table";
import {
  CreateGrammarDialog,
  CreateVocabularyDialog,
} from "./growth-toolbox-action-dialogs";

export default async function GrowthToolboxListing() {
  const result = await getGrowthToolboxManagementData();
  const courseNames = new Map(
    result.courseTree.map((course) => [course.id, course.title]),
  );
  const courseOptions = result.courseTree.map((course) => ({
    id: course.id,
    title: course.title,
  }));
  const toolboxItems: GrowthToolboxItemDisplayRow[] = result.toolboxItems.map(
    (item) => ({
      ...item,
      relatedCourseTitle: item.relatedCourseId
        ? (courseNames.get(item.relatedCourseId) ?? "关联课程未出现在当前课程结构中")
        : "未关联课程",
    }),
  );
  const enabledCount = toolboxItems.filter((item) => item.isEnabled).length;
  const textbookVocabularyCount = result.vocabularyLibrary.filter(
    (item) => item.source === "textbook",
  ).length;
  const grammarAudioCount = result.grammarLibrary.reduce(
    (total, item) =>
      total +
      item.rows.filter((row) => Boolean(row.audio)).length +
      item.examples.filter((example) => Boolean(example.audio)).length,
    0,
  );

  return (
    <div className="space-y-6">
      {result.hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          工具入口、课程结构、词汇库或语法库数据暂时无法完整读取，请稍后刷新重试。
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th>管理范围</th>
                <th>工具入口</th>
                <th>已启用</th>
                <th>词汇总数</th>
                <th>教材词汇</th>
                <th>语法总数</th>
                <th>语法音频</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>成长工具箱</th>
                <td>{toolboxItems.length}</td>
                <td>{enabledCount}</td>
                <td>{result.vocabularyLibrary.length}</td>
                <td>{textbookVocabularyCount}</td>
                <td>{result.grammarLibrary.length}</td>
                <td>{grammarAudioCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ReadOnlySection
        title="工具入口"
        description="查看学生端入口的启停状态、展示顺序和关联课程。"
      >
        <GrowthToolboxItemsTable data={toolboxItems} courses={courseOptions} />
      </ReadOnlySection>

      <ReadOnlySection
        title="词汇库"
        description="查看独立练习词库及互动教材导入来源。"
        action={<CreateVocabularyDialog />}
      >
        <GrowthToolboxVocabularyTable data={result.vocabularyLibrary} />
      </ReadOnlySection>

      <ReadOnlySection
        title="语法库"
        description="查看语法结构、例句、注意事项和已配置的音频字段。"
        action={<CreateGrammarDialog />}
      >
        <GrowthToolboxGrammarTable data={result.grammarLibrary} />
      </ReadOnlySection>
    </div>
  );
}

function ReadOnlySection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--app-text)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--app-muted)]">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
