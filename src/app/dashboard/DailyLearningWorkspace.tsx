import Link from "next/link";
import {
  ArrowRight,
  BookCheck,
  BookOpen,
  CheckCircle2,
  Circle,
  CirclePlay,
  Clock3,
  Compass,
  FileCheck2,
  Hourglass,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type {
  HomeLearningTask,
  HomeLearningTaskSourceType,
  HomeLearningTaskStatus,
} from "@/features/student-home-learning/api/types";

const SUGGESTION_SOURCE_TYPES = new Set<HomeLearningTaskSourceType>([
  "course",
  "chapter_practice",
  "specialized_practice",
  "review",
]);

const SOURCE_LABELS: Record<HomeLearningTaskSourceType, string> = {
  assignment: "作业",
  exam: "考试",
  course: "课程学习",
  chapter_practice: "章节巩固",
  specialized_practice: "专项训练",
  review: "错题复习",
  teacher_recommendation: "老师推荐",
  student_plan: "学习计划",
};

const STATUS_DETAILS: Record<
  HomeLearningTaskStatus,
  { label: string; icon: LucideIcon }
> = {
  not_started: { label: "未开始", icon: Circle },
  available: { label: "可以开始", icon: CirclePlay },
  in_progress: { label: "进行中", icon: Clock3 },
  submitted: { label: "已提交", icon: Send },
  pending_grading: { label: "等待批改", icon: Hourglass },
  completed: { label: "已完成", icon: CheckCircle2 },
  overdue: { label: "已逾期", icon: TriangleAlert },
  locked: { label: "尚未开放", icon: LockKeyhole },
  unavailable: { label: "暂不可用", icon: LockKeyhole },
};

const SEOUL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const SEOUL_LAST_VIEWED_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(value: string, now: Date): string {
  const differenceMinutes = Math.round(
    (new Date(value).getTime() - now.getTime()) / 60_000,
  );
  const absoluteMinutes = Math.abs(differenceMinutes);
  const suffix = differenceMinutes < 0 ? "前" : "后";

  if (absoluteMinutes < 1) return "现在";
  if (absoluteMinutes < 60) return `${absoluteMinutes} 分钟${suffix}`;
  if (absoluteMinutes < 24 * 60) {
    return `${Math.round(absoluteMinutes / 60)} 小时${suffix}`;
  }
  return `${Math.round(absoluteMinutes / (24 * 60))} 天${suffix}`;
}

function formatTaskSchedule(task: HomeLearningTask, now: Date): string | null {
  const startsAt = safeDate(task.startsAt);
  if (task.status === "locked" && startsAt) {
    return `开始 ${formatRelativeTime(task.startsAt!, now)} · ${SEOUL_DATE_TIME_FORMATTER.format(startsAt)}（首尔时间）`;
  }

  const dueAt = safeDate(task.dueAt);
  if (dueAt) {
    return `截止 ${formatRelativeTime(task.dueAt!, now)} · ${SEOUL_DATE_TIME_FORMATTER.format(dueAt)}（首尔时间）`;
  }

  if (startsAt) {
    return `开始 ${formatRelativeTime(task.startsAt!, now)} · ${SEOUL_DATE_TIME_FORMATTER.format(startsAt)}（首尔时间）`;
  }

  if (task.progressPercent !== null) {
    return `当前进度 ${Math.round(task.progressPercent)}%`;
  }

  return null;
}

function requiredTypeLabel(task: HomeLearningTask): string {
  if (
    task.sourceType === "exam" &&
    `${task.title}${task.description ?? ""}${task.reason}`.includes("补考")
  ) {
    return "补考";
  }
  return SOURCE_LABELS[task.sourceType];
}

function actionLabel(task: HomeLearningTask): string {
  if (task.status === "locked" || task.status === "unavailable") {
    return "查看开放条件";
  }
  if (task.sourceType === "course") return "继续学习";
  if (task.sourceType === "chapter_practice") return "开始巩固";
  if (task.sourceType === "specialized_practice") return "开始训练";
  if (task.sourceType === "review") return "开始复习";
  if (task.status === "in_progress") return "继续完成";
  return task.sourceType === "exam" ? "进入考试" : "开始完成";
}

function TaskStatus({ status }: { status: HomeLearningTaskStatus }) {
  const detail = STATUS_DETAILS[status];
  const Icon = detail.icon;

  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-2.5 text-xs font-semibold text-[var(--foreground-muted)]">
      <Icon size={14} aria-hidden="true" />
      {detail.label}
    </span>
  );
}

function TaskAction({ task, prominent = false }: { task: HomeLearningTask; prominent?: boolean }) {
  if (task.status === "pending_grading") {
    return (
      <p role="status" className="text-sm font-semibold text-[var(--status-warning)]">
        已提交，等待老师批改，无需重复提交
      </p>
    );
  }
  if (task.status === "completed") {
    return <p role="status" className="text-sm font-semibold text-[var(--status-success)]">已完成</p>;
  }
  return (
    <Link
      href={task.href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
        prominent
          ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
          : "border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--surface-soft)]"
      }`}
    >
      <Play size={15} fill={prominent ? "currentColor" : "none"} aria-hidden="true" />
      {actionLabel(task)}
    </Link>
  );
}

function SectionTitle({
  title,
  description,
  icon: Icon,
  color,
  soft,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  color?: string;
  soft?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ color, backgroundColor: soft }}
          aria-hidden="true"
        >
          <Icon size={13} />
        </span>
      )}
      <CardTitleWithHint
        className="min-w-0 flex-1"
        title={title}
        description={description}
        headingLevel={2}
        titleClassName="text-sm font-bold tracking-tight"
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  action,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <Icon size={20} className="shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <CardTitleWithHint
          title={title}
          description={description}
          headingLevel={3}
          titleClassName="text-sm font-bold"
        />
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[var(--primary-hover)] hover:underline"
      >
        {action}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

function ContinueTaskCard({ task }: { task: HomeLearningTask }) {
  const descriptionParts = (task.description ?? "").split(" · ").filter(Boolean);
  const courseTitle = descriptionParts[0] ?? null;
  const lessonTitle = descriptionParts[1] ?? null;
  const positionTitle = task.title.replace(/^继续学习/, "");
  const chapterTitle = positionTitle !== lessonTitle ? positionTitle : null;
  const progress = Math.max(0, Math.min(100, task.progressPercent ?? 0));
  const updatedAt = safeDate(task.updatedAt);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <TaskStatus status={task.status} />
        <span className="text-xs font-semibold text-[var(--foreground-muted)]">
          上次学习 {updatedAt ? SEOUL_LAST_VIEWED_FORMATTER.format(updatedAt) : "时间未知"}
        </span>
      </div>

      <CardTitleWithHint
        className="mt-2"
        title={positionTitle || task.title}
        description={task.description ?? task.reason}
        headingLevel={3}
        titleClassName="text-base font-bold leading-6 tracking-tight"
      />

      <p className="mt-1 text-xs text-[var(--foreground-muted)]">
        {[courseTitle, lessonTitle, chapterTitle].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold">
          <span className="text-[var(--foreground-muted)]">当前进度</span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]"
          role="progressbar"
          aria-label={`当前进度 ${Math.round(progress)}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span
            className="block h-full rounded-full bg-[var(--primary)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
        <span className="font-semibold text-[var(--foreground)]">继续原因：</span>
        {task.reason}
      </p>
      <div className="mt-3">
        <TaskAction task={task} />
      </div>
    </div>
  );
}

type LearningEntryNavProps = {
  coursesHref: string;
  assignmentsHref: string;
  coursePracticeHref: string;
  specializedPracticeHref: string;
  reviewHref: string;
};

export function LearningEntryNav({
  coursesHref,
  assignmentsHref,
  coursePracticeHref,
  specializedPracticeHref,
  reviewHref,
}: LearningEntryNavProps) {
  const navigationEntries = [
    { label: "课程学习", href: coursesHref, icon: BookOpen },
    { label: "作业考试", href: assignmentsHref, icon: FileCheck2 },
    { label: "巩固中心", href: coursePracticeHref, icon: BookCheck },
    { label: "专项训练", href: specializedPracticeHref, icon: Target },
    { label: "错题复习", href: reviewHref, icon: RotateCcw },
  ];

  return (
    <nav aria-label="学习入口">
      <SectionTitle
        title="学习入口"
        description="这些入口保留完整业务功能，首页任务区只负责摘要、排序和跳转。"
        icon={Compass}
        color="var(--primary)"
        soft="var(--accent)"
      />
      <div className="mt-2 flex flex-col divide-y divide-[var(--border-subtle)]">
        {navigationEntries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.label}
              href={entry.href}
              className="group flex min-h-11 items-center gap-2.5 py-2 font-semibold transition hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <Icon size={16} className="shrink-0 text-[var(--foreground-muted)] group-hover:text-[var(--primary)]" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words text-sm">{entry.label}</span>
              <ArrowRight size={14} className="shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function RequiredTodayCard({
  requiredTodayTasks,
  nowISOString,
  coursesHref,
}: {
  requiredTodayTasks: HomeLearningTask[];
  nowISOString: string;
  coursesHref: string;
}) {
  const now = new Date(nowISOString);

  return (
    <section aria-label="今日必须完成">
      <SectionTitle
        title="今日必须完成"
        description="这里只显示今天开始、今天截止或仍可补交的必做任务，并沿用统一紧急程度顺序。"
        icon={ListChecks}
        color="var(--primary)"
        soft="var(--accent)"
      />

      {requiredTodayTasks.length > 0 ? (
        <div className="mt-2 divide-y divide-[var(--border-subtle)]">
          {requiredTodayTasks.map((task) => (
            <article key={task.taskKey} className="py-3 first:pt-2 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--accent)] px-2.5 text-xs font-semibold text-[var(--primary-hover)]">
                  {requiredTypeLabel(task)}
                </span>
                <TaskStatus status={task.status} />
              </div>
              <CardTitleWithHint
                className="mt-2"
                title={task.title}
                description={task.description ?? task.reason}
                headingLevel={3}
                titleClassName="text-base font-bold leading-6 tracking-tight"
              />
              {formatTaskSchedule(task, now) && (
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-[var(--foreground-muted)]">
                  <Clock3 size={14} aria-hidden="true" />
                  {formatTaskSchedule(task, now)}
                </p>
              )}
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                <span className="font-semibold text-[var(--foreground)]">必做原因：</span>
                {task.reason}
              </p>
              <div className="mt-3">
                <TaskAction task={task} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="今天没有必须完成的任务"
          description="没有临近截止或已逾期可补交的必做任务，可以按自己的节奏继续课程。"
          href={coursesHref}
          action="继续课程"
          icon={ListChecks}
        />
      )}
    </section>
  );
}

export function DailyLearningLoadFailedCard({
  reloadHref,
  coursesHref,
}: {
  reloadHref: string;
  coursesHref: string;
}) {
  return (
    <section aria-label="今日学习加载状态">
      <CardTitleWithHint
        title="今日学习暂时无法加载"
        description="任务数据读取失败，课程与练习入口仍可正常使用。"
        headingLevel={2}
        titleClassName="text-base font-bold tracking-tight"
      />
      <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
        请重新加载任务区；如果问题持续，可以先从课程或巩固中心继续学习。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={reloadHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          重新加载
        </a>
        <Link
          href={coursesHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          继续课程
        </Link>
      </div>
    </section>
  );
}

export function MostImportantTaskCard({
  tasks,
  nowISOString,
  coursesHref,
}: {
  tasks: HomeLearningTask[];
  nowISOString: string;
  coursesHref: string;
}) {
  const now = new Date(nowISOString);
  const mostImportant = tasks[0] ?? null;

  return (
    <section aria-label="今天最重要">
      <SectionTitle
        title="今天最重要"
        description="系统根据截止时间、任务状态与学习连续性，只选出一个当前优先任务。"
        icon={Star}
        color="var(--primary)"
        soft="var(--accent)"
      />

      {mostImportant ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--accent)] px-2.5 text-xs font-semibold text-[var(--primary-hover)]">
                来源：{SOURCE_LABELS[mostImportant.sourceType]}
              </span>
              <TaskStatus status={mostImportant.status} />
            </div>
            <CardTitleWithHint
              className="mt-3"
              title={mostImportant.title}
              description={mostImportant.description ?? mostImportant.reason}
              headingLevel={3}
              titleClassName="text-xl font-bold leading-8 tracking-tight sm:text-2xl"
            />
            {formatTaskSchedule(mostImportant, now) && (
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                <Clock3 size={16} aria-hidden="true" />
                {formatTaskSchedule(mostImportant, now)}
              </p>
            )}
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
              <span className="font-semibold text-[var(--foreground)]">推荐原因：</span>
              {mostImportant.reason}
            </p>
          </div>
          <TaskAction task={mostImportant} prominent />
        </div>
      ) : (
        <EmptyState
          title="今天没有待处理任务"
          description="任务完成后，首要位置会保持简洁，不会填入虚构推荐。"
          href={coursesHref}
          action="继续课程"
          icon={CheckCircle2}
        />
      )}
    </section>
  );
}

export function ContinueLastLearningCard({
  tasks,
  coursesHref,
}: {
  tasks: HomeLearningTask[];
  coursesHref: string;
}) {
  const continueTask = tasks.find((task) => task.sourceType === "course") ?? null;

  return (
    <section aria-label="继续上次学习">
      <SectionTitle
        title="继续上次学习"
        description="只保留最近一个有效学习位置，进入后从原课程、课时或章节继续。"
        icon={CirclePlay}
        color="var(--support)"
        soft="var(--support-surface)"
      />
      {continueTask ? (
        <ContinueTaskCard task={continueTask} />
      ) : (
        <EmptyState
          title="还没有可继续的位置"
          description="从课程目录开始学习后，这里会记录最后一个有效位置。"
          href={coursesHref}
          action="选择课程"
          icon={BookOpen}
        />
      )}
    </section>
  );
}

export function TodaySuggestionsCard({
  tasks,
  coursePracticeHref,
}: {
  tasks: HomeLearningTask[];
  coursePracticeHref: string;
}) {
  const continueTask = tasks.find((task) => task.sourceType === "course") ?? null;
  const suggestions = tasks
    .filter(
      (task) =>
        !task.required &&
        SUGGESTION_SOURCE_TYPES.has(task.sourceType) &&
        task.taskKey !== continueTask?.taskKey,
    )
    .slice(0, 3);

  return (
    <section aria-label="今日建议">
      <SectionTitle
        title="今日建议"
        description="从非必做的课程、章节巩固、专项训练和错题复习中，最多选择三条建议。"
        icon={Lightbulb}
        color="var(--status-warning)"
        soft="var(--status-warning-surface)"
      />

      {suggestions.length > 0 ? (
        <div className="mt-2 divide-y divide-[var(--border-subtle)]">
          {suggestions.map((task) => (
            <article key={task.taskKey} className="flex min-w-0 flex-wrap items-center gap-3 py-2.5 first:pt-2 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 text-xs font-semibold text-[var(--primary-hover)]">
                    <Lightbulb size={14} aria-hidden="true" />
                    {SOURCE_LABELS[task.sourceType]}
                  </span>
                  <TaskStatus status={task.status} />
                </div>
                <CardTitleWithHint
                  className="mt-2"
                  title={task.title}
                  description={task.description ?? task.reason}
                  headingLevel={3}
                  titleClassName="text-sm font-bold leading-6 tracking-tight"
                />
                <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
                  <span className="font-semibold text-[var(--foreground)]">建议原因：</span>
                  {task.reason}
                </p>
              </div>
              <TaskAction task={task} />
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="今天暂时没有额外建议"
          description="系统不会用占位任务填满列表，可以进入巩固中心自主选择内容。"
          href={coursePracticeHref}
          action="进入巩固中心"
          icon={Sparkles}
        />
      )}
    </section>
  );
}
