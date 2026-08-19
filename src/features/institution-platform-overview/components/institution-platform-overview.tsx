import { CircleAlert } from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";

import { PLATFORM_LEARNING_RULE_DEFAULTS } from "../defaults.ts";
import type {
  InstitutionLearningOverview,
  InstitutionPlatformOverviewSnapshot,
  OverviewRate,
} from "../types.ts";

const priorityLabels: Record<string, string> = {
  overdue_required_completable: "可补交的逾期必做",
  due_today: "今天截止",
  exam_within_24_hours: "24 小时内考试",
  teacher_required_recommendation: "老师必做推荐",
  due_tomorrow: "明天截止",
  in_progress_course_or_chapter_practice: "进行中的课程或章节巩固",
  due_this_week: "本周截止",
  review: "错题复习",
  weak_skill_specialized_practice: "薄弱能力专项训练",
  continue_learning: "继续学习",
};

export function InstitutionPlatformOverviewLoadError({
  retryHref,
}: {
  retryHref: string;
}) {
  return (
    <section className="app-card border p-5" role="alert" aria-label="学习概览加载状态">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--status-danger)]">
        <CircleAlert size={17} aria-hidden="true" />
        学习概览加载失败
      </span>
      <CardTitleWithHint
        className="mt-3"
        title="机构与平台学习数据暂时无法读取"
        description="其他管理功能仍可继续使用，重新加载后会再次读取最新聚合数据。"
        headingLevel={2}
        titleClassName="text-base font-semibold"
        hintLabel="查看学习概览加载失败说明"
      />
      <a
        href={retryHref}
        className="management-secondary-button mt-4 inline-flex min-h-11 items-center justify-center border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
      >
        重新加载学习概览
      </a>
    </section>
  );
}

const metricDefinitions = [
  {
    key: "active",
    title: "今日活跃率",
    description: "首尔时区今天产生过学生课程、任务或练习活动的学生，占当前有效学生的比例；老师批改与退回不算学生学习。",
  },
  {
    key: "requiredCompletion",
    title: "今日必做完成率",
    description: "沿用学生首页和班级今日情况的状态口径，统计今天开放、今天截止或允许补交的逾期必做作业与考试。",
  },
  {
    key: "homeworkOnTime",
    title: "作业按时完成率",
    description: "已经到达有效截止时间的作业中，学生曾在截止时间前提交的比例。",
  },
  {
    key: "examParticipation",
    title: "考试参与率",
    description: "已经开放的考试中，学生已经开始作答或产生提交的比例。",
  },
  {
    key: "chapterPracticeUsage",
    title: "章节巩固使用率",
    description: "当前有效学生中，已经开始或完成过章节巩固的学生比例。",
  },
  {
    key: "reviewUsage",
    title: "错题复习使用率",
    description: "当前有效学生中，至少有错题进入复习中或已掌握状态的学生比例；仅生成待复习错题不计入使用。",
  },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    InstitutionLearningOverview,
    | "active"
    | "requiredCompletion"
    | "homeworkOnTime"
    | "examParticipation"
    | "chapterPracticeUsage"
    | "reviewUsage"
  >;
  title: string;
  description: string;
}>;

function RateValue({ value }: { value: OverviewRate }) {
  return (
    <>
      <strong className="mt-3 block text-2xl font-semibold tabular-nums">
        {value.rate.toFixed(1)}%
      </strong>
      <span className="app-muted-text mt-1 block text-xs tabular-nums">
        {value.completed} / {value.total}
      </span>
    </>
  );
}

function InstitutionMetrics({ institution }: { institution: InstitutionLearningOverview }) {
  return (
    <section
      className="grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      aria-label={`${institution.tenantName}学习指标`}
    >
      {metricDefinitions.map((metric) => (
        <article key={metric.key} className="min-h-32 border-b p-4 last:border-b-0 sm:border-r xl:border-b-0">
          <CardTitleWithHint
            title={metric.title}
            description={metric.description}
            headingLevel={3}
            titleClassName="text-xs font-medium text-[var(--foreground-secondary)]"
            hintLabel={`查看${metric.title}统计口径`}
          />
          <RateValue value={institution[metric.key]} />
        </article>
      ))}
    </section>
  );
}

function ClassComparison({ institution }: { institution: InstitutionLearningOverview }) {
  return (
    <section className="app-card overflow-hidden border">
      <div className="border-b p-4">
        <CardTitleWithHint
          title="班级对比"
          description="班级沿用现有教学分配，以负责老师和学生应用为一个比较单元；学生可因多位负责老师出现在多个班级中。"
          headingLevel={2}
          hintLabel="查看班级划分与统计口径"
        />
      </div>
      {institution.classes.length === 0 ? (
        <p className="app-muted-text p-5 text-sm">当前机构还没有可比较的应用级教学分配。</p>
      ) : (
        <>
          <div className="divide-y sm:hidden">
            {institution.classes.map((row) => (
              <article key={row.classKey} className="p-4">
                <h3 className="break-words text-sm font-semibold">{row.className}</h3>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="app-muted-text">学生</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{row.studentCount}</dd>
                  </div>
                  <div>
                    <dt className="app-muted-text">今日活跃率</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{row.active.rate.toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt className="app-muted-text">必做完成率</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{row.requiredCompletion.rate.toFixed(1)}%</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden sm:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs text-[var(--foreground-secondary)]">
              <tr>
                <th scope="col" className="w-2/5 px-4 py-3 font-medium">班级</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">学生</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">今日活跃率</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">必做完成率</th>
              </tr>
            </thead>
            <tbody>
              {institution.classes.map((row) => (
                <tr key={row.classKey} className="border-t first:border-t-0">
                  <th scope="row" className="break-words px-4 py-3 font-medium">{row.className}</th>
                  <td className="px-4 py-3 text-right tabular-nums">{row.studentCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.active.rate.toFixed(1)}%
                    <span className="app-muted-text ml-2 text-xs">{row.active.completed}/{row.active.total}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.requiredCompletion.rate.toFixed(1)}%
                    <span className="app-muted-text ml-2 text-xs">{row.requiredCompletion.completed}/{row.requiredCompletion.total}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}

function PlatformInstitutionComparison({ institutions }: { institutions: InstitutionLearningOverview[] }) {
  return (
    <section className="app-card overflow-hidden border">
      <div className="border-b p-4">
        <CardTitleWithHint
          title="机构学习使用对比"
          description="平台负责人当前是全局角色，因此这里汇总全部正常运行机构，只返回机构级匿名统计，不返回学生身份或明细。"
          headingLevel={2}
          hintLabel="查看平台汇总范围"
        />
      </div>
      {institutions.length === 0 ? (
        <p className="app-muted-text p-5 text-sm">暂无正常运行机构的学习数据。</p>
      ) : (
        <>
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:hidden">
            {institutions.map((institution) => (
              <article key={institution.tenantId} className="border bg-[var(--surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-sm font-semibold">{institution.tenantName}</h3>
                  <span className="shrink-0 text-xs font-medium tabular-nums">
                    {institution.studentCount} 名学生
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {metricDefinitions.map((metric) => (
                    <div key={metric.key} className="min-w-0">
                      <dt className="app-muted-text break-words text-xs">{metric.title}</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums">
                        {institution[metric.key].rate.toFixed(1)}%
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden xl:block">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-[var(--surface-soft)] text-xs text-[var(--foreground-secondary)]">
              <tr>
                <th scope="col" className="w-1/6 px-3 py-3 font-medium">机构</th>
                <th scope="col" className="px-2 py-3 text-right font-medium">有效学生</th>
                {metricDefinitions.map((metric) => (
                  <th key={metric.key} scope="col" className="break-words px-2 py-3 text-right font-medium">{metric.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {institutions.map((institution) => (
                <tr key={institution.tenantId} className="border-t first:border-t-0">
                  <th scope="row" className="break-words px-3 py-3 font-medium">{institution.tenantName}</th>
                  <td className="px-2 py-3 text-right tabular-nums">{institution.studentCount}</td>
                  {metricDefinitions.map((metric) => (
                    <td key={metric.key} className="px-2 py-3 text-right tabular-nums">
                      {institution[metric.key].rate.toFixed(1)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}

function PlatformRuleDefaults() {
  const rules = PLATFORM_LEARNING_RULE_DEFAULTS;
  const rows = [
    ["即将截止范围", `${rules.dueSoonHours} 小时`],
    ["系统建议数量上限", `${rules.maxSystemSuggestions} 项`],
    ["薄弱能力推荐门槛", `掌握度低于 ${rules.weakSkillMasteryPercentBelow}%`],
    ["错题推荐门槛", `累计错误至少 ${rules.reviewErrorCountAtLeast} 次`],
    ["默认周目标", `每周 ${rules.weeklyTargetDays} 天、${rules.weeklyTargetMinutes} 分钟`],
  ];
  return (
    <section className="app-card border p-4">
      <CardTitleWithHint
        title="当前平台学习规则"
        description="第一版使用集中代码默认值，暂不提供编辑入口；任务优先级继续复用学生首页的确定性排序。"
        headingLevel={2}
        hintLabel="查看平台规则来源"
      />
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="border bg-[var(--surface-soft)] p-3">
            <dt className="app-muted-text text-xs">{label}</dt>
            <dd className="mt-1 text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 border-t pt-3 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
          查看任务优先级顺序
        </summary>
        <ol className="app-muted-text mt-3 grid list-decimal gap-1 pl-5 sm:grid-cols-2">
          {rules.taskPriorityOrder.map((rule) => (
            <li key={rule}>{priorityLabels[rule] ?? rule}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}

export function InstitutionPlatformOverview({
  snapshot,
}: {
  snapshot: InstitutionPlatformOverviewSnapshot;
}) {
  if (snapshot.scope === "platform") {
    return (
      <section className="space-y-4" aria-labelledby="learning-overview-title">
        <h2 id="learning-overview-title" className="text-lg font-semibold">学习使用概览</h2>
        <PlatformInstitutionComparison institutions={snapshot.institutions} />
        <PlatformRuleDefaults />
      </section>
    );
  }

  const institution = snapshot.institutions[0];
  return (
    <section className="space-y-4" aria-labelledby="learning-overview-title">
      <h2 id="learning-overview-title" className="text-lg font-semibold">机构学习概览</h2>
      {institution ? (
        <>
          <InstitutionMetrics institution={institution} />
          <ClassComparison institution={institution} />
        </>
      ) : (
        <div className="app-card border p-5 text-sm">当前机构暂无可汇总的学习数据。</div>
      )}
    </section>
  );
}
