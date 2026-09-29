import { requireActiveUser } from "@/lib/auth";
import { chapterPracticeSnapshot, type ChapterPracticeBinding } from "@/lib/chapter-practice-binding";
import { ChapterPracticeBindingPanel } from "./chapter-practice-binding";
import {
  ManagementNotice,
} from "@/components/layout/management-page";
import { getGrowthToolboxManagementData } from "../api/service";
import { getDigitalTextbookManagementData } from "@/features/digital-textbook/api/service";
import { textbookPracticeResources } from "@/lib/textbook-practice-resources";
import { TextbookResourceCatalog } from "./textbook-resource-catalog";
import { practiceSourceNotice } from "@/lib/course-content-workflow";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { GrowthToolboxWorkspace, GrowthToolboxLibrary } from "./growth-toolbox-workspace";
import { GrowthToolboxGrammarTable } from "./grammar-table";
import { GrowthToolboxItemsTable } from "./toolbox-items-table";
import type { GrowthToolboxItemDisplayRow } from "./toolbox-items-table/columns";
import { GrowthToolboxVocabularyTable } from "./vocabulary-table";
import {
  CreateGrammarDialog,
  CreateVocabularyDialog,
} from "./lazy-growth-toolbox-action-dialogs";

export default async function GrowthToolboxListing({
  studentAppId,
  chapterId,
}: {
  studentAppId: string;
  chapterId?: string;
}) {
  const result = await getGrowthToolboxManagementData(studentAppId);
  const textbookResult = await getDigitalTextbookManagementData(studentAppId);
  const { supabase } = await requireActiveUser();
  const bindingResult = chapterId && result.canManage ? await supabase.from("chapter_practice_bindings")
    .select("id,chapter_id,version_id,revision,is_enabled,snapshot,reviewed_at")
    .eq("student_app_id", studentAppId).eq("chapter_id", chapterId).maybeSingle() : null;
  const currentSnapshot = chapterId && !textbookResult.hasError ? chapterPracticeSnapshot(textbookResult.courses, chapterId) : null;
  const binding = bindingResult?.data as ChapterPracticeBinding | null;
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

  return (
    <div className="space-y-6">
      {result.hasError && (
        <ManagementNotice tone="warning">
          工具入口、课程结构、词汇库或语法库数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <GrowthToolboxWorkspace settings={
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
      } chapter={<div className="space-y-4">
      {chapterId && result.canManage && <ChapterPracticeBindingPanel
        key={`${chapterId}:${binding?.revision ?? 0}:${JSON.stringify(currentSnapshot)}`}
        appId={studentAppId} chapterId={chapterId} current={currentSnapshot}
        binding={binding} available={Boolean(bindingResult && !bindingResult.error && !textbookResult.hasError && !result.hasError)}
      />}
      {!chapterId && result.canManage && <ManagementNotice>在上方选择章节与教材版本后，可核对并关联本章教材练习。</ManagementNotice>}
      {!result.canManage && <ManagementNotice>当前权限仅可查看独立练习库和工具设置，不能管理章节练习关联。</ManagementNotice>}
      </div>} library={<div className="space-y-5">
      <CardTitleWithHint title="独立练习库" headingLevel={2}
        description={`这里展示当前应用的全部独立资源，不随上方章节筛选，也不代表已关联到本章。${practiceSourceNotice}`}
        hintLabel="独立练习库的范围与保存规则" />
      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <summary className="cursor-pointer text-sm font-medium">从教材添加 · {chapterId ? "所选章节" : "全部章节"}</summary>
        <div className="mt-4">
      {textbookResult.hasError ? (
        <ManagementNotice tone="warning">教材来源未能完整读取，暂不提供复制入口。现有练习库仍可查看。</ManagementNotice>
      ) : (
        <TextbookResourceCatalog
          resources={textbookPracticeResources(textbookResult.courses).filter(resource => !chapterId || resource.chapterId === chapterId)}
          vocabulary={result.vocabularyLibrary}
          grammar={result.grammarLibrary}
          studentAppId={studentAppId}
          canManage={result.canManage && !result.hasError}
        />
      )}
        </div>
      </details>
      <GrowthToolboxLibrary vocabulary={
      <ReadOnlySection
        title="独立词汇库"
        description="查看独立练习词库及互动教材导入来源。"
        action={result.canManage ? <CreateVocabularyDialog studentAppId={studentAppId} /> : null}
      >
        <GrowthToolboxVocabularyTable
          data={result.vocabularyLibrary}
          studentAppId={studentAppId}
          canManage={result.canManage}
        />
      </ReadOnlySection>
      } grammar={
      <ReadOnlySection
        title="独立语法库"
        description="查看语法结构、例句、注意事项和已配置的音频字段。"
        action={result.canManage ? <CreateGrammarDialog studentAppId={studentAppId} /> : null}
      >
        <GrowthToolboxGrammarTable
          data={result.grammarLibrary}
          studentAppId={studentAppId}
          canManage={result.canManage}
        />
      </ReadOnlySection>
      } />
      </div>} />
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
        <CardTitleWithHint title={title} description={description} headingLevel={3}
          titleClassName="text-base font-semibold text-[var(--foreground)]" hintLabel={`${title}说明`} />
        {action}
      </div>
      {children}
    </section>
  );
}
