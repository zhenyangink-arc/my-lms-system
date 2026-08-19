import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock3,
  Hourglass,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { RouteLinkStatus } from "@/app/dashboard/RouteLinkStatus";
import type {
  TeacherClassTodaySnapshot,
  TeacherClassTodayStudent,
  TeacherClassTodayTask,
  TeacherClassTaskStatus,
} from "../types.ts";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const taskStatusLabels: Record<TeacherClassTaskStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  pending_grading: "待批改",
  completed: "已完成",
  overdue: "已逾期",
  locked: "未开放",
};

const taskStatusTones: Record<TeacherClassTaskStatus, string> = {
  not_started: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)]",
  in_progress: "border-[var(--primary)]/25 bg-[var(--accent)] text-[var(--primary-hover)]",
  pending_grading: "border-[var(--support)]/25 bg-[var(--surface-soft)] text-[var(--support)]",
  completed: "border-[var(--status-success)]/25 bg-[var(--status-success-surface)] text-[var(--status-success)]",
  overdue: "border-[var(--status-danger)]/25 bg-[var(--status-danger-surface)] text-[var(--status-danger)]",
  locked: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground-muted)]",
};

const taskStatusIcons: Record<TeacherClassTaskStatus, LucideIcon> = {
  not_started: Circle,
  in_progress: Clock3,
  pending_grading: Hourglass,
  completed: CheckCircle2,
  overdue: CircleAlert,
  locked: LockKeyhole,
};

function studentName(student: TeacherClassTodayStudent) {
  return student.fullName ?? student.loginId ?? `学生 ${student.studentId.slice(-6)}`;
}

function SummaryMetric({
  title,
  value,
  description,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  detail?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-h-32 border bg-[var(--card)] p-4">
      <CardTitleWithHint
        title={(
          <span className="inline-flex items-center gap-1.5">
            <Icon size={14} aria-hidden="true" />
            {title}
          </span>
        )}
        description={description}
        headingLevel={3}
        titleClassName="text-xs font-medium text-[var(--foreground-secondary)]"
        hintLabel={`查看${title}统计口径`}
      />
      <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? (
        <p className="app-muted-text mt-1 text-xs tabular-nums">{detail}</p>
      ) : null}
    </div>
  );
}

function CountBadge({
  children,
  tone = "default",
  icon: Icon,
}: {
  children: React.ReactNode;
  tone?: "default" | "danger" | "support" | "success";
  icon?: LucideIcon;
}) {
  const toneClass = {
    default: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)]",
    danger: "border-[var(--status-danger)]/25 bg-[var(--status-danger-surface)] text-[var(--status-danger)]",
    support: "border-[var(--support)]/25 bg-[var(--surface-soft)] text-[var(--support)]",
    success: "border-[var(--status-success)]/25 bg-[var(--status-success-surface)] text-[var(--status-success)]",
  }[tone];
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium tabular-nums ${toneClass}`}>
      {Icon ? <Icon size={13} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function StudentStatusCard({
  student,
  detailBasePath,
}: {
  student: TeacherClassTodayStudent;
  detailBasePath: string;
}) {
  return (
    <article className="grid gap-4 border-b p-4 last:border-b-0 md:grid-cols-[minmax(12rem,1.25fr)_minmax(16rem,2fr)_auto] md:items-center">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{studentName(student)}</h3>
        <p className="app-muted-text mt-1 truncate text-xs">
          {student.loginId ?? `…${student.studentId.slice(-8)}`}
        </p>
        <p className="app-muted-text mt-2 text-xs">
          {student.lastActivityAt ? (
            <>
              最近学习：
              <LocalDateTime
                value={student.lastActivityAt}
                options={DATE_TIME_OPTIONS}
              />
            </>
          ) : (
            "暂无学习记录"
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label={`${studentName(student)}的今日任务状态`}>
        <CountBadge tone={student.studiedToday ? "success" : "default"} icon={student.studiedToday ? CheckCircle2 : Circle}>
          {student.studiedToday ? "今天已学习" : "今天未学习"}
        </CountBadge>
        {student.notStartedTaskCount > 0 ? (
          <CountBadge icon={Circle}>未开始 {student.notStartedTaskCount}</CountBadge>
        ) : null}
        {student.inProgressTaskCount > 0 ? (
          <CountBadge icon={Clock3}>进行中 {student.inProgressTaskCount}</CountBadge>
        ) : null}
        {student.completedTaskCount > 0 ? (
          <CountBadge tone="success" icon={CheckCircle2}>已完成 {student.completedTaskCount}</CountBadge>
        ) : null}
        {student.overdueTaskCount > 0 ? (
          <CountBadge tone="danger" icon={CircleAlert}>逾期 {student.overdueTaskCount}</CountBadge>
        ) : null}
        {student.pendingGradingTaskCount > 0 ? (
          <CountBadge tone="support" icon={Hourglass}>待批改 {student.pendingGradingTaskCount}</CountBadge>
        ) : null}
        {student.continuousNoLearning ? (
          <CountBadge tone="danger" icon={CircleAlert}>连续 {student.inactiveDays} 天未学习</CountBadge>
        ) : null}
      </div>

      <Link
        href={`${detailBasePath}/${student.studentId}`}
        prefetch={false}
        className="management-secondary-button inline-flex min-h-11 items-center justify-center gap-2 self-start border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 md:self-center"
        aria-label={`查看${studentName(student)}的任务明细`}
      >
        查看明细
        <RouteLinkStatus />
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}

export function TeacherClassTodayDashboard({
  snapshot,
  detailBasePath,
}: {
  snapshot: TeacherClassTodaySnapshot;
  detailBasePath: string;
}) {
  const { summary } = snapshot;
  return (
    <div className="space-y-5">
      <section className="grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4" aria-label="班级今日汇总">
        <SummaryMetric
          title="负责学生"
          icon={BookOpenCheck}
          value={summary.studentCount}
          description="只统计当前老师在这个应用中被正式分配、且应用授权仍然有效的学生。"
        />
        <SummaryMetric
          title="今天已学习"
          icon={CheckCircle2}
          value={summary.studiedTodayCount}
          description="首尔时区今天零点后产生过课程、任务或练习活动记录的学生人数。"
        />
        <SummaryMetric
          title="今日必做完成率"
          icon={CheckCircle2}
          value={`${summary.requiredCompletionRate.toFixed(1)}%`}
          detail={`${summary.requiredTaskCompleted} / ${summary.requiredTaskTotal} 项`}
          description="已完成的今日必做作业或考试数量，占今日必做任务总量的比例；待批改单独统计。"
        />
        <SummaryMetric
          title="未开始"
          icon={Circle}
          value={summary.notStartedCount}
          description="至少有一项今日必做任务仍为未开始或尚未开放的学生人数。"
        />
        <SummaryMetric
          title="逾期"
          icon={CircleAlert}
          value={summary.overdueCount}
          description="至少有一项已过有效截止时间、且尚未完成或提交待批改任务的学生人数。"
        />
        <SummaryMetric
          title="待批改"
          icon={Hourglass}
          value={summary.pendingGradingCount}
          description="至少有一项已提交、当前处于等待人工批改状态任务的学生人数。"
        />
        <SummaryMetric
          title="连续未学习"
          icon={CircleAlert}
          value={summary.continuousNoLearningCount}
          description="截至今天零点，连续至少三个首尔自然日没有本应用学习活动的学生人数。"
        />
        <SummaryMetric
          title="进行中 / 已完成"
          icon={Clock3}
          value={`${summary.inProgressCount} / ${summary.completedCount}`}
          description="分别统计至少有一项今日必做任务进行中或已完成的学生人数。"
        />
      </section>

      <section className="overflow-hidden rounded-lg border bg-[var(--card)]" aria-labelledby="student-task-status-title">
        <div className="border-b p-4 sm:p-5">
          <CardTitleWithHint
            title="学生任务状态"
            description="每名学生只显示汇总状态；进入明细后可查看今日相关任务。状态优先沿用学生首页的作业与考试映射。"
            headingLevel={2}
            titleClassName="text-sm font-semibold"
            hintLabel="查看学生任务状态说明"
          />
        </div>
        {snapshot.students.length > 0 ? (
          <div>
            {snapshot.students.map((student) => (
              <StudentStatusCard
                key={student.studentId}
                student={student}
                detailBasePath={detailBasePath}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center">
            <BookOpenCheck className="size-8 text-[var(--foreground-muted)]" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold">暂无负责学生</h3>
            <p className="app-muted-text mt-1 max-w-md text-xs leading-5">
              当前应用还没有处于有效教学分配范围内的学生。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: TeacherClassTaskStatus }) {
  const Icon = taskStatusIcons[status];
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${taskStatusTones[status]}`}>
      <Icon size={13} aria-hidden="true" />
      {taskStatusLabels[status]}
    </span>
  );
}

function TaskCard({ task }: { task: TeacherClassTodayTask }) {
  return (
    <li className="grid gap-4 border-b p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-sm font-semibold">{task.title}</h3>
          <TaskStatusBadge status={task.status} />
          {task.isRequiredToday ? <CountBadge>今日必做</CountBadge> : null}
        </div>
        <p className="app-muted-text mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>{task.assignmentType === "exam" ? "考试" : "作业"}</span>
          <span>
            开始：<LocalDateTime value={task.startsAt} options={DATE_TIME_OPTIONS} />
          </span>
          <span>
            截止：<LocalDateTime value={task.dueAt} options={DATE_TIME_OPTIONS} />
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
        {task.status === "completed" ? (
          <CheckCircle2 size={16} aria-hidden="true" />
        ) : task.status === "overdue" ? (
          <CircleAlert size={16} aria-hidden="true" />
        ) : (
          <Clock3 size={16} aria-hidden="true" />
        )}
        <span>{taskStatusLabels[task.status]}</span>
      </div>
    </li>
  );
}

export function TeacherStudentTodayDetail({
  snapshot,
  backHref,
}: {
  snapshot: TeacherClassTodaySnapshot;
  backHref: string;
}) {
  const student = snapshot.students[0];
  if (!student) return null;
  const completionRate = student.requiredTaskTotal === 0
    ? 0
    : Math.round((student.requiredTaskCompleted * 1000) / student.requiredTaskTotal) / 10;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-[var(--card)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{studentName(student)}</h2>
            <p className="app-muted-text mt-1 text-xs">
              {student.loginId ?? `…${student.studentId.slice(-8)}`}
            </p>
          </div>
          <Link
            href={backHref}
            className="management-secondary-button inline-flex min-h-11 items-center justify-center border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            返回班级情况
            <RouteLinkStatus />
          </Link>
        </div>
        <dl className="mt-5 grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["今天学习", student.studiedToday ? "已学习" : "未学习"],
            ["今日必做", `${student.requiredTaskCompleted} / ${student.requiredTaskTotal}`],
            ["完成率", `${completionRate.toFixed(1)}%`],
            ["连续未学习", student.continuousNoLearning ? `${student.inactiveDays} 天` : "否"],
          ].map(([label, value], index) => (
            <div key={label} className={`p-4 ${index > 0 ? "border-t sm:border-l sm:border-t-0" : ""}`}>
              <dt className="app-muted-text text-xs">{label}</dt>
              <dd className="mt-2 text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="overflow-hidden rounded-lg border bg-[var(--card)]" aria-labelledby="student-today-task-detail-title">
        <div className="border-b p-4 sm:p-5">
          <CardTitleWithHint
            title="今日任务明细"
            description="显示今日必做，以及仍处于进行中、逾期或待批改状态的相关任务；不包含答案、评分键或未发布成绩。"
            headingLevel={2}
            titleClassName="text-sm font-semibold"
            hintLabel="查看任务明细范围"
          />
        </div>
        {snapshot.tasks.length > 0 ? (
          <ul>
            {snapshot.tasks.map((task) => (
              <TaskCard key={task.assignmentId} task={task} />
            ))}
          </ul>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold">今天没有需要跟进的任务</p>
            <p className="app-muted-text mt-1 text-xs">该学生当前没有今日必做、进行中、逾期或待批改任务。</p>
          </div>
        )}
      </section>
    </div>
  );
}
