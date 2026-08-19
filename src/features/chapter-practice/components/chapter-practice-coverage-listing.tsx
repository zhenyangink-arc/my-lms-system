import {
  CheckCircle2,
  CircleAlert,
  CircleMinus,
  CircleX,
} from "lucide-react";
import Link from "next/link";

import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { cn } from "@/lib/utils";
import { getChapterPracticeCoverage } from "../api/service";
import {
  CHAPTER_PRACTICE_SKILLS,
  type ChapterPracticeCoverageRow,
  type ChapterPracticeSkill,
  type ChapterPracticeUnitStatus,
} from "../api/types";
import { ChapterPracticeGenerateButton } from "./chapter-practice-generate-button";

const skillLabels: Record<ChapterPracticeSkill, string> = {
  listening: "听",
  speaking: "说",
  reading: "读",
  writing: "写",
  vocabulary: "词汇",
  grammar: "语法",
};

const practiceStatusLabels: Record<ChapterPracticeUnitStatus, string> = {
  not_generated: "未生成",
  draft: "草稿",
  pending_review: "待检查",
  published: "已发布",
  needs_update: "需更新",
  disabled: "已停用",
};

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type StatusTone = "success" | "warning" | "muted";

function StatusMark({
  label,
  tone,
  compact = false,
}: {
  label: string;
  tone: StatusTone;
  compact?: boolean;
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "warning"
        ? CircleAlert
        : CircleMinus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        tone === "success" &&
          "bg-[var(--status-success-surface)] text-[var(--status-success)]",
        tone === "warning" &&
          "bg-[var(--status-warning-surface)] text-[var(--status-warning)]",
        tone === "muted" &&
          "bg-[var(--muted)] text-[var(--foreground-muted)]",
      )}
    >
      <Icon size={compact ? 11 : 12} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

function PublishedMark({ published }: { published: boolean }) {
  return (
    <StatusMark
      label={published ? "已发布" : "未发布"}
      tone={published ? "success" : "warning"}
    />
  );
}

function SkillCoverage({ row }: { row: ChapterPracticeCoverageRow }) {
  return (
    <div className="flex max-w-64 flex-wrap gap-1" aria-label="六项练习覆盖状态">
      {CHAPTER_PRACTICE_SKILLS.map((skill) => {
        const available = row.skills[skill];
        const Icon = available ? CheckCircle2 : CircleX;
        return (
          <span
            key={skill}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              available
                ? "bg-[var(--status-success-surface)] text-[var(--status-success)]"
                : "bg-[var(--status-warning-surface)] text-[var(--status-warning)]",
            )}
          >
            <Icon size={11} strokeWidth={2} aria-hidden="true" />
            {skillLabels[skill]}{available ? "已有" : "缺少"}
          </span>
        );
      })}
    </div>
  );
}

function PracticeStatusMark({ status }: { status: ChapterPracticeUnitStatus }) {
  const tone: StatusTone =
    status === "published"
      ? "success"
      : status === "disabled"
        ? "muted"
        : "warning";
  return <StatusMark label={practiceStatusLabels[status]} tone={tone} />;
}

function PracticeDetails({ row }: { row: ChapterPracticeCoverageRow }) {
  if (!row.practice.isGenerated) {
    return (
      <div className="grid gap-1">
        <StatusMark label="未生成" tone="warning" />
        <span className="text-[11px] text-[var(--foreground-muted)]">
          版本：未生成
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <StatusMark label="已生成" tone="success" />
      <span className="text-[11px] text-[var(--foreground-muted)]">
        版本：v{row.practice.version}
      </span>
    </div>
  );
}

function SyncDetails({ row }: { row: ChapterPracticeCoverageRow }) {
  if (!row.practice.isGenerated || !row.practice.lastSyncedAt) {
    return (
      <div className="grid gap-1">
        <span className="text-[11px] text-[var(--foreground-muted)]">
          上次同步：未生成
        </span>
        <StatusMark label="未生成" tone="warning" compact />
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <time
        dateTime={row.practice.lastSyncedAt}
        className="text-[11px] tabular-nums text-[var(--foreground-secondary)]"
      >
        {dateTimeFormatter.format(new Date(row.practice.lastSyncedAt))}
      </time>
      <StatusMark
        label={row.practice.needsUpdate ? "需更新" : "无需更新"}
        tone={row.practice.needsUpdate ? "warning" : "success"}
        compact
      />
    </div>
  );
}

function SourceCoverage({ row }: { row: ChapterPracticeCoverageRow }) {
  return (
    <div className="grid gap-1.5">
      <PublishedMark published={row.textbook.isPublished} />
      <span className="text-[11px] tabular-nums text-[var(--foreground-muted)]">
        核心词汇 {row.textbook.vocabularyCount} · 核心语法 {row.textbook.grammarCount}
      </span>
    </div>
  );
}

function AssignmentCoverage({ row }: { row: ChapterPracticeCoverageRow }) {
  return (
    <div className="grid gap-1.5">
      <span className="flex items-center justify-between gap-2 text-[11px]">
        <span>作业</span>
        <PublishedMark published={row.homeworkPublished} />
      </span>
      <span className="flex items-center justify-between gap-2 text-[11px]">
        <span>章节测试</span>
        <PublishedMark published={row.chapterTestPublished} />
      </span>
    </div>
  );
}

function ChapterAction({
  row,
  space,
}: {
  row: ChapterPracticeCoverageRow;
  space: string;
}) {
  if (!row.practice.isGenerated) {
    return (
      <ChapterPracticeGenerateButton
        space={space}
        appSlug="korean"
        courseChapterId={row.id}
      />
    );
  }
  return (
    <Link
      href={`/${space}/dashboard/admin/apps/korean/practice-center/${row.id}`}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-xs font-semibold hover:bg-[var(--muted)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
    >
      {row.practice.status === "published" ? "查看版本" : "编辑与预览"}
    </Link>
  );
}

function CoverageCard({ row, space }: { row: ChapterPracticeCoverageRow; space: string }) {
  return (
    <article className="space-y-4 p-4" aria-labelledby={`coverage-${row.id}`}>
      <div>
        <p className="text-[11px] leading-5 text-[var(--foreground-muted)]">
          {row.course.title}　›　{row.lesson.title}
        </p>
        <h3 id={`coverage-${row.id}`} className="text-sm font-semibold">
          {row.chapter.title}
        </h3>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="mb-1.5 text-[11px] font-medium text-[var(--foreground-muted)]">
            课程与章节
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            <StatusMark
              label={`课程${row.course.isPublished ? "已发布" : "未发布"}`}
              tone={row.course.isPublished ? "success" : "warning"}
            />
            <StatusMark
              label={`章节${row.chapter.isPublished ? "已发布" : "未发布"}`}
              tone={row.chapter.isPublished ? "success" : "warning"}
            />
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 text-[11px] font-medium text-[var(--foreground-muted)]">
            教材与核心内容
          </dt>
          <dd><SourceCoverage row={row} /></dd>
        </div>
        <div>
          <dt className="mb-1.5 text-[11px] font-medium text-[var(--foreground-muted)]">
            六项练习
          </dt>
          <dd><SkillCoverage row={row} /></dd>
        </div>
        <div>
          <dt className="mb-1.5 text-[11px] font-medium text-[var(--foreground-muted)]">
            作业与测试
          </dt>
          <dd><AssignmentCoverage row={row} /></dd>
        </div>
        <div>
          <dt className="mb-1.5 text-[11px] font-medium text-[var(--foreground-muted)]">
            巩固内容
          </dt>
          <dd className="flex flex-wrap items-start gap-2">
            <PracticeDetails row={row} />
            <PracticeStatusMark status={row.practice.status} />
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 text-[11px] font-medium text-[var(--foreground-muted)]">
            同步与更新
          </dt>
          <dd><SyncDetails row={row} /></dd>
        </div>
      </dl>
      <div className="border-t pt-4">
        <ChapterAction row={row} space={space} />
      </div>
    </article>
  );
}

export default async function ChapterPracticeCoverageListing({
  space,
}: {
  space: string;
}) {
  const result = await getChapterPracticeCoverage();

  return (
    <div className="space-y-6">
      <ManagementNotice>
        从真实课程树选择章节生成草稿；发布前会重新检查内容来源、完成规则、判定配置、音频状态与排序引用。
      </ManagementNotice>

      <ManagementMetricStrip
        label="巩固内容覆盖概况"
        items={[
          { label: "课程", value: result.courseCount },
          { label: "课时", value: result.lessonCount },
          { label: "章节", value: result.chapterCount },
          { label: "已生成", value: result.generatedCount },
          { label: "需更新", value: result.needsUpdateCount },
        ]}
      />

      <section className="overflow-hidden rounded-lg border bg-[var(--card)]">
        <div className="border-b px-4 py-3">
          <CardTitleWithHint
            title="章节巩固覆盖矩阵"
            description="按课程、课时、章节顺序汇总教材、核心词汇与语法、六项练习、作业、测试及巩固内容版本状态。"
            headingLevel={2}
            titleClassName="text-sm font-semibold"
            hintLabel="查看覆盖矩阵说明"
          />
        </div>

        {result.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--foreground-muted)]">
            当前韩国语平台课程树中没有章节。
          </div>
        ) : (
          <>
            <div className="divide-y 2xl:hidden">
              {result.rows.map((row) => (
                <CoverageCard key={row.id} row={row} space={space} />
              ))}
            </div>

            <div className="hidden overflow-x-auto 2xl:block">
              <table className="w-full min-w-[1240px] border-collapse text-left text-xs">
                <caption className="sr-only">
                  韩国语真实课程树的章节巩固内容覆盖状态
                </caption>
                <thead className="bg-[var(--muted)] text-[var(--foreground-secondary)]">
                  <tr>
                    <th scope="col" className="w-[280px] px-3 py-2.5 font-semibold">课程、课时与章节</th>
                    <th scope="col" className="w-[145px] px-3 py-2.5 font-semibold">发布状态</th>
                    <th scope="col" className="w-[175px] px-3 py-2.5 font-semibold">教材与核心内容</th>
                    <th scope="col" className="w-[250px] px-3 py-2.5 font-semibold">六项练习</th>
                    <th scope="col" className="w-[150px] px-3 py-2.5 font-semibold">作业与测试</th>
                    <th scope="col" className="w-[175px] px-3 py-2.5 font-semibold">巩固内容</th>
                    <th scope="col" className="w-[165px] px-3 py-2.5 font-semibold">同步与更新</th>
                    <th scope="col" className="w-[130px] px-3 py-2.5 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-[var(--muted)]/40">
                      <th scope="row" className="px-3 py-3 font-normal">
                        <p className="text-[10px] leading-4 text-[var(--foreground-muted)]">
                          {row.course.title}　›　{row.lesson.title}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-[var(--foreground)]">
                          {row.chapter.title}
                        </p>
                      </th>
                      <td className="px-3 py-3">
                        <div className="grid gap-1.5">
                          <StatusMark
                            label={`课程${row.course.isPublished ? "已发布" : "未发布"}`}
                            tone={row.course.isPublished ? "success" : "warning"}
                          />
                          <StatusMark
                            label={`章节${row.chapter.isPublished ? "已发布" : "未发布"}`}
                            tone={row.chapter.isPublished ? "success" : "warning"}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3"><SourceCoverage row={row} /></td>
                      <td className="px-3 py-3"><SkillCoverage row={row} /></td>
                      <td className="px-3 py-3"><AssignmentCoverage row={row} /></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-start gap-2">
                          <PracticeDetails row={row} />
                          <PracticeStatusMark status={row.practice.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3"><SyncDetails row={row} /></td>
                      <td className="px-3 py-3"><ChapterAction row={row} space={space} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
