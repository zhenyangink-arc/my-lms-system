import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { getGrowthToolboxManagementData } from "../api/service";
import { GrowthToolboxGrammarTable } from "./grammar-table";
import { GrowthToolboxItemsTable } from "./toolbox-items-table";
import type { GrowthToolboxItemDisplayRow } from "./toolbox-items-table/columns";
import { GrowthToolboxVocabularyTable } from "./vocabulary-table";
import {
  CreateGrammarDialog,
  CreateVocabularyDialog,
} from "./growth-toolbox-action-dialogs";

export default async function GrowthToolboxListing({
  studentAppId,
}: {
  studentAppId: string;
}) {
  const result = await getGrowthToolboxManagementData(studentAppId);
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
        <ManagementNotice tone="warning">
          工具入口、课程结构、词汇库或语法库数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="练习工具概况"
        items={[
          { label: "工具入口", value: toolboxItems.length },
          { label: "已启用", value: enabledCount },
          { label: "词汇总数", value: result.vocabularyLibrary.length },
          { label: "教材词汇", value: textbookVocabularyCount },
          { label: "语法总数", value: result.grammarLibrary.length },
          { label: "语法音频", value: grammarAudioCount },
        ]}
      />

      <ReadOnlySection
        title="工具入口"
        description="查看学生端入口的启停状态、展示顺序和关联课程。"
      >
        <GrowthToolboxItemsTable
          data={toolboxItems}
          courses={courseOptions}
          studentAppId={studentAppId}
          canManage={result.canManage}
        />
      </ReadOnlySection>

      <ReadOnlySection
        title="词汇库"
        description="查看独立练习词库及互动教材导入来源。"
        action={result.canManage ? <CreateVocabularyDialog studentAppId={studentAppId} /> : null}
      >
        <GrowthToolboxVocabularyTable
          data={result.vocabularyLibrary}
          studentAppId={studentAppId}
          canManage={result.canManage}
        />
      </ReadOnlySection>

      <ReadOnlySection
        title="语法库"
        description="查看语法结构、例句、注意事项和已配置的音频字段。"
        action={result.canManage ? <CreateGrammarDialog studentAppId={studentAppId} /> : null}
      >
        <GrowthToolboxGrammarTable
          data={result.grammarLibrary}
          studentAppId={studentAppId}
          canManage={result.canManage}
        />
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
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
