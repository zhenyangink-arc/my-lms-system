"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilePenLine,
  RotateCcw,
  Search,
  Timer,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASSIGNMENT_DATE_OPTIONS,
  type AssignmentType,
  type SubmissionStatus,
} from "./config";

const assignmentDateFormatter = new Intl.DateTimeFormat(
  "zh-CN",
  ASSIGNMENT_DATE_OPTIONS,
);

function formatAssignmentDate(value: string | null) {
  if (!value) return "时间待定";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "时间待确认"
    : assignmentDateFormatter.format(date);
}

type AssignmentItem = {
  id: string;
  title: string;
  description: string;
  assignment_type: AssignmentType;
  course_id: string | null;
  total_points: number;
  starts_at: string;
  due_at: string;
  duration_minutes: number | null;
  allow_resubmission: boolean;
  courseTitle: string;
  courseGroup: string;
  courseGroupSlug: string;
  latestSubmission: {
    status: SubmissionStatus;
    score: number | null;
    feedback: string | null;
    attemptNumber: number;
  } | null;
};

type ChapterTestItem = {
  id: string;
  slug: string;
  title: string;
  koreanTitle: string;
  description: string;
  chapterNumber: number;
  courseTitle: string;
  courseGroup: string;
  durationMinutes: number;
  passingScore: number;
  questionCount: number;
  unlocked: boolean;
  unlockRequirement: string | null;
  studyHref: string;
  attempt: { score: number; passed: boolean } | null;
};

type TaskKind = "chapter_test" | "homework" | "exam";
type TaskState =
  | "pending"
  | "revision_required"
  | "submitted"
  | "graded"
  | "upcoming"
  | "overdue"
  | "locked"
  | "preview";
type StatusFilter = "all" | "todo" | "revision" | "submitted" | "completed" | "locked";
export type TaskTypeFilter = "all" | TaskKind;

type UnifiedTask = {
  id: string;
  href: string;
  kind: TaskKind;
  state: TaskState;
  title: string;
  courseTitle: string;
  courseGroup: string;
  description: string;
  durationMinutes: number | null;
  score: number | null;
  totalPoints: number;
  questionCount: number | null;
  chapterNumber: number | null;
  startsAt: string | null;
  dueAt: string | null;
  allowResubmission: boolean;
  unlockRequirement: string | null;
  studyHref: string | null;
};

const kindPresentation = {
  chapter_test: {
    label: "章节测试",
    shortLabel: "课后练习",
    icon: BookOpenCheck,
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  homework: {
    label: "老师作业",
    shortLabel: "需提交",
    icon: FilePenLine,
    color: "var(--primary)",
    soft: "var(--accent)",
  },
  exam: {
    label: "正式考试",
    shortLabel: "限时",
    icon: ClipboardCheck,
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
  },
} satisfies Record<
  TaskKind,
  { label: string; shortLabel: string; icon: typeof BookOpenCheck; color: string; soft: string }
>;

const statePresentation: Record<TaskState, { label: string; color: string; soft: string }> = {
  pending: { label: "待完成", color: "var(--primary)", soft: "var(--accent)" },
  revision_required: { label: "需修改", color: "var(--status-danger)", soft: "var(--status-danger-surface)" },
  submitted: { label: "待批改", color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  graded: { label: "已完成", color: "var(--status-success)", soft: "var(--status-success-surface)" },
  upcoming: { label: "未开放", color: "var(--support)", soft: "var(--support-surface)" },
  overdue: { label: "已截止", color: "var(--status-danger)", soft: "var(--status-danger-surface)" },
  locked: { label: "未解锁", color: "var(--foreground-muted)", soft: "var(--surface-soft)" },
  preview: { label: "学生端预览", color: "var(--support)", soft: "var(--support-surface)" },
};

const typeStatusFilters: Record<
  TaskKind,
  Array<{ value: StatusFilter; label: string }>
> = {
  chapter_test: [
    { value: "todo", label: "待完成" },
    { value: "revision", label: "需重做" },
    { value: "completed", label: "已完成" },
    { value: "locked", label: "未解锁" },
  ],
  homework: [
    { value: "todo", label: "待完成" },
    { value: "revision", label: "需修改" },
    { value: "submitted", label: "待批改" },
    { value: "completed", label: "已完成" },
  ],
  exam: [
    { value: "todo", label: "待完成" },
    { value: "submitted", label: "待批改" },
    { value: "completed", label: "已完成" },
  ],
};

function taskMatchesStatus(task: UnifiedTask, filter: StatusFilter) {
  return (
    filter === "all" ||
    (filter === "todo" && ["pending", "upcoming"].includes(task.state)) ||
    (filter === "revision" && task.state === "revision_required") ||
    (filter === "submitted" && task.state === "submitted") ||
    (filter === "completed" && task.state === "graded") ||
    (filter === "locked" && task.state === "locked")
  );
}

function getAssignmentState(item: AssignmentItem, isManager: boolean, now: number): TaskState {
  if (isManager) return new Date(item.due_at).getTime() < now ? "overdue" : "preview";
  if (item.latestSubmission) return item.latestSubmission.status;
  if (new Date(item.starts_at).getTime() > now) return "upcoming";
  return new Date(item.due_at).getTime() < now ? "overdue" : "pending";
}

function getDeadlineLabel(task: UnifiedTask, now: number) {
  if (task.state === "locked") return task.unlockRequirement ?? "完成前置章节后解锁";
  if (task.kind === "chapter_test") return task.state === "graded" ? "已完成" : "建议现在完成";
  if (task.state === "upcoming" && task.startsAt) return `${formatAssignmentDate(task.startsAt)} 开放`;
  if (!task.dueAt) return "时间待定";

  const difference = new Date(task.dueAt).getTime() - now;
  const days = Math.ceil(difference / 86_400_000);
  if (difference < 0) return "已截止";
  if (days <= 0) return "今天截止";
  if (days === 1) return "明天截止";
  if (days <= 7) return `还剩 ${days} 天`;
  return formatAssignmentDate(task.dueAt);
}

function getActionLabel(task: UnifiedTask) {
  if (task.state === "locked") return "尚未解锁";
  if (task.state === "revision_required") return task.kind === "chapter_test" ? "重新测试" : "查看反馈";
  if (task.state === "pending") return task.kind === "chapter_test" ? "开始测试" : "开始作答";
  if (task.state === "upcoming") return "查看安排";
  if (task.state === "submitted") return "查看提交";
  if (task.state === "graded") return task.kind === "chapter_test" ? "重新测试" : "查看批改";
  return task.state === "preview" ? "查看预览" : "查看详情";
}

function sortTasks(a: UnifiedTask, b: UnifiedTask) {
  const rank: Record<TaskState, number> = {
    revision_required: 0,
    pending: 1,
    upcoming: 2,
    submitted: 3,
    preview: 4,
    graded: 5,
    overdue: 6,
    locked: 7,
  };
  const stateDifference = rank[a.state] - rank[b.state];
  if (stateDifference !== 0) return stateDifference;

  const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return (a.chapterNumber ?? 999) - (b.chapterNumber ?? 999);
}

function TaskRow({
  task,
  currentTime,
  timeline = false,
}: {
  task: UnifiedTask;
  currentTime: number;
  timeline?: boolean;
}) {
  const kind = kindPresentation[task.kind];
  const state = statePresentation[task.state];
  const KindIcon = kind.icon;
  const deadlineLabel = getDeadlineLabel(task, currentTime);
  const urgent =
    task.dueAt &&
    ["pending", "revision_required"].includes(task.state) &&
    new Date(task.dueAt).getTime() - currentTime <= 3 * 86_400_000;
  const locked = task.state === "locked";

  const card = (
    <Card
      size="sm"
      className={`relative gap-0 overflow-hidden py-0 transition duration-200 ${
        locked
          ? "bg-[var(--surface-soft)] opacity-85"
          : "group-hover:-translate-y-0.5 group-hover:shadow-md"
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: state.color }} />
      <CardContent className="grid min-h-[104px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 p-3 pl-4 sm:p-4 sm:pl-5 lg:grid-cols-[auto_minmax(0,1fr)_minmax(150px,220px)_auto] lg:gap-x-5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ color: kind.color, backgroundColor: kind.soft }}
        >
          <KindIcon size={20} />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold" style={{ color: kind.color }}>{task.courseTitle}</span>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color: state.color, backgroundColor: state.soft }}>
              {state.label}
            </span>
          </div>
          <h5 className="mt-1 truncate text-sm font-bold sm:text-[15px]">{task.title}</h5>
          <div className="app-muted-text mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-bold">
            <span>{kind.label}</span>
            {task.chapterNumber && <span>第 {task.chapterNumber} 章</span>}
            {task.questionCount !== null && <span>{task.questionCount} 题</span>}
            {task.durationMinutes && <span className="inline-flex items-center gap-1"><Timer size={10} />{task.durationMinutes} 分钟</span>}
            {task.kind !== "chapter_test" && <span>{task.totalPoints} 分</span>}
            {task.allowResubmission && task.kind !== "chapter_test" && <span className="inline-flex items-center gap-1"><RotateCcw size={10} />可再次提交</span>}
          </div>
        </div>

        <div className="col-span-2 flex items-center justify-between gap-3 border-t pt-2.5 lg:col-span-1 lg:block lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="flex items-start gap-1.5 text-[11px] font-bold leading-5" style={{ color: urgent ? "var(--status-danger)" : locked ? state.color : "var(--foreground)" }}>
            {urgent ? <AlertCircle className="mt-1 shrink-0" size={12} /> : <Clock3 className="mt-1 shrink-0" size={12} />}
            <span>{deadlineLabel}</span>
          </p>
          {task.dueAt && <p className="app-muted-text mt-1 text-[9px]">{formatAssignmentDate(task.dueAt)}</p>}
          {task.score !== null && task.state === "graded" && (
            <p className="text-base font-bold lg:mt-1" style={{ color: state.color }}>
              {task.score}<span className="ml-0.5 text-[9px] app-muted-text">/ {task.totalPoints}</span>
            </p>
          )}
        </div>

        {locked && task.studyHref ? (
          <div className="col-span-2 flex items-center justify-end gap-2 lg:col-span-1">
            <Link
              href={task.studyHref}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--support)] focus-visible:ring-offset-2"
              style={{ backgroundColor: "var(--support)" }}
            >
              <BookOpenCheck size={13} />
              学习本章
            </Link>
            <span
              className="inline-flex h-8 cursor-not-allowed items-center justify-center rounded-lg px-3 text-xs font-bold"
              style={{ color: state.color, backgroundColor: state.soft }}
            >
              {getActionLabel(task)}
            </span>
          </div>
        ) : (
          <span
            className="col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white transition group-hover:brightness-95 lg:col-span-1"
            style={{
              backgroundColor:
                task.kind === "chapter_test" && task.state === "graded"
                  ? "var(--status-warning)"
                  : state.color,
            }}
          >
            {getActionLabel(task)}
            <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={timeline ? "relative" : undefined}>
      {timeline && (
        <span
          aria-hidden="true"
          className="absolute -left-[29px] top-10 z-10 h-4 w-4 rounded-full border-[3px] border-[var(--card)] shadow-sm"
          style={{ backgroundColor: state.color }}
        />
      )}
      {locked ? (
        <div aria-disabled="true">{card}</div>
      ) : (
        <Link
          href={task.href}
          className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--support)] focus-visible:ring-offset-2"
        >
          {card}
        </Link>
      )}
    </div>
  );
}

export function AssignmentBoard({
  items,
  chapterTests,
  isManager,
  currentTime,
  initialTaskTypeFilter = "all",
}: {
  items: AssignmentItem[];
  chapterTests: ChapterTestItem[];
  isManager: boolean;
  currentTime: number;
  initialTaskTypeFilter?: TaskTypeFilter;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>(
    initialTaskTypeFilter,
  );
  const [courseFilter, setCourseFilter] = useState("all");
  const [query, setQuery] = useState("");

  const tasks = useMemo<UnifiedTask[]>(() => {
    const assignmentTasks = items.map<UnifiedTask>((item) => ({
      id: item.id,
      href: `/dashboard/assignments/${item.id}?type=${
        item.assignment_type === "exam" ? "exam" : "homework"
      }`,
      kind: item.assignment_type === "exam" ? "exam" : "homework",
      state: getAssignmentState(item, isManager, currentTime),
      title: item.title,
      courseTitle: item.courseTitle,
      courseGroup: item.courseGroup,
      description: item.description,
      durationMinutes: item.duration_minutes,
      score: item.latestSubmission?.score ?? null,
      totalPoints: item.total_points,
      questionCount: null,
      chapterNumber: null,
      startsAt: item.starts_at,
      dueAt: item.due_at,
      allowResubmission: item.allow_resubmission,
      unlockRequirement: null,
      studyHref: null,
    }));

    const testTasks = chapterTests.map<UnifiedTask>((test) => ({
      id: `chapter-test-${test.id}`,
      href: `/dashboard/assignments/korean/${test.slug}`,
      kind: "chapter_test",
      state: !test.unlocked
        ? "locked"
        : isManager
        ? "preview"
        : test.attempt
          ? test.attempt.passed
            ? "graded"
            : "revision_required"
          : "pending",
      title: test.title,
      courseTitle: test.courseTitle,
      courseGroup: test.courseGroup,
      description: test.koreanTitle || test.description,
      durationMinutes: test.durationMinutes,
      score: test.attempt?.score ?? null,
      totalPoints: 100,
      questionCount: test.questionCount,
      chapterNumber: test.chapterNumber,
      startsAt: null,
      dueAt: null,
      allowResubmission: true,
      unlockRequirement: test.unlockRequirement,
      studyHref: test.studyHref,
    }));

    return [...assignmentTasks, ...testTasks].sort(sortTasks);
  }, [chapterTests, currentTime, isManager, items]);

  const counts = {
    todo: tasks.filter((task) => task.state === "pending").length,
    revision: tasks.filter((task) => task.state === "revision_required").length,
    submitted: tasks.filter((task) => task.state === "submitted").length,
    completed: tasks.filter((task) => task.state === "graded").length,
  };

  const typeCounts = {
    chapter_test: tasks.filter((task) => task.kind === "chapter_test").length,
    homework: tasks.filter((task) => task.kind === "homework").length,
    exam: tasks.filter((task) => task.kind === "exam").length,
  };

  const courseGroups = useMemo(
    () => [...new Set(tasks.map((task) => task.courseGroup))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [tasks]
  );

  const filteredTasks = tasks.filter((task) => {
    const typeMatches = taskTypeFilter === "all" || task.kind === taskTypeFilter;
    const statusMatches = taskMatchesStatus(task, statusFilter);
    const courseMatches = courseFilter === "all" || task.courseGroup === courseFilter;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const queryMatches =
      !normalizedQuery ||
      `${task.title} ${task.description} ${task.courseTitle}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery);
    return typeMatches && statusMatches && courseMatches && queryMatches;
  });
  const chapterTimelineTasks = filteredTasks
    .filter((task) => task.kind === "chapter_test")
    .sort(
      (a, b) =>
        a.courseTitle.localeCompare(b.courseTitle, "zh-CN") ||
        (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)
    );
  const assignmentListTasks = filteredTasks.filter(
    (task) => task.kind !== "chapter_test"
  );

  return (
    <div className="space-y-4">
      {isManager && <section
        className="app-card overflow-hidden rounded-[2rem] border p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(130deg, var(--accent), var(--card) 56%, var(--support-surface))",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {isManager && (
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}
              >
                <ClipboardCheck size={15} />
                学生端任务预览
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">学习任务</h2>
            </div>
          )}

          <div className={`grid grid-cols-3 gap-2 ${isManager ? "sm:min-w-[360px]" : "w-full"}`}>
            {[
              ["待完成", counts.todo, FilePenLine, "var(--primary)", "var(--accent)"],
              ["需修改", counts.revision, RotateCcw, "var(--status-danger)", "var(--status-danger-surface)"],
              ["已完成", counts.completed, Award, "var(--status-success)", "var(--status-success-surface)"],
            ].map(([label, value, Icon, color, soft]) => {
              const MetricIcon = Icon as typeof Award;
              return (
                <div key={String(label)} className="app-card flex items-center gap-3 rounded-2xl border px-3 py-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: String(color), backgroundColor: String(soft) }}
                  >
                    <MetricIcon size={16} />
                  </span>
                  <div>
                    <p className="text-xl font-bold leading-none">{String(value)}</p>
                    <p className="app-muted-text mt-1 text-[10px] font-bold">{String(label)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>}

      <section id="task-list" className="scroll-mt-5 px-1 py-1">
        <div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight">我的学习任务</h3>
              <p className="app-muted-text mt-1 text-xs font-bold">按优先顺序完成测试、作业和考试</p>
            </div>
            <p className="app-muted-text text-xs font-bold">共 {tasks.length} 项</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(Object.keys(kindPresentation) as TaskKind[]).map((kind) => {
              const item = kindPresentation[kind];
              const Icon = item.icon;
              const active = taskTypeFilter === kind;
              return (
                <div key={kind} className="min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTaskTypeFilter(active && statusFilter === "all" ? "all" : kind);
                      setStatusFilter("all");
                    }}
                    aria-pressed={active && statusFilter === "all"}
                    className="flex min-h-18 w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                    style={{
                      backgroundColor: active ? item.soft : "var(--card)",
                      borderColor: active ? item.color : "var(--border-subtle)",
                      boxShadow: active ? `0 0 0 1px ${item.color}` : undefined,
                    }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: item.color, backgroundColor: item.soft }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className="app-muted-text mt-0.5 block text-[10px] font-bold">{item.shortLabel}</span>
                    </span>
                    <span className="text-2xl font-bold tabular-nums" style={{ color: item.color }}>
                      {typeCounts[kind]}
                    </span>
                  </Button>

                  <div className="mt-1.5 flex min-w-0 gap-1 overflow-x-auto px-1">
                    {typeStatusFilters[kind].map((filter) => {
                      const count = tasks.filter(
                        (task) => task.kind === kind && taskMatchesStatus(task, filter.value)
                      ).length;
                      const selected = active && statusFilter === filter.value;
                      return (
                        <Button
                          key={filter.value}
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setTaskTypeFilter(kind);
                            setStatusFilter(selected ? "all" : filter.value);
                          }}
                          aria-pressed={selected}
                          className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-[9px] font-bold transition"
                          style={{
                            color: selected ? item.color : "var(--foreground-muted)",
                            backgroundColor: selected ? item.soft : "var(--surface-soft)",
                          }}
                        >
                          <span className="truncate">{filter.label}</span>
                          <span className="tabular-nums opacity-75">{count}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {(tasks.length > 6 || courseGroups.length > 1) && (
            <div className="mt-3 flex justify-end border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="grid w-full shrink-0 gap-2 sm:w-[460px] sm:grid-cols-2">
                <label className="relative">
                  <span className="sr-only">搜索任务</span>
                  <Search className="app-muted-text pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={15} />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务或课程" className="h-8 pl-9 text-xs" />
                </label>
                {courseGroups.length > 1 && (
                  <label>
                    <span className="sr-only">按课程筛选</span>
                    <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="app-input h-8 w-full rounded-lg border px-3 text-xs font-bold">
                      <option value="all">全部课程</option>
                      {courseGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="space-y-6">
          {chapterTimelineTasks.length > 0 && (
            <div>
              <div className="mb-3 px-1">
                <h4 className="text-sm font-bold">章节学习路线</h4>
                <p className="app-muted-text mt-1 text-[10px] font-bold">学完本章电子书，并按顺序通过前一章测试后解锁</p>
              </div>
              <div className="ml-5 space-y-2 border-l pl-5" style={{ borderColor: "var(--border-subtle)" }}>
                {chapterTimelineTasks.map((task) => (
                  <TaskRow key={task.id} task={task} currentTime={currentTime} timeline />
                ))}
              </div>
            </div>
          )}

          {assignmentListTasks.length > 0 && (
            <div>
              <div className="mb-3 px-1">
                <h4 className="text-sm font-bold">老师作业与考试</h4>
                <p className="app-muted-text mt-1 text-[10px] font-bold">按截止时间与完成状态排列</p>
              </div>
              <div className="space-y-2">
                {assignmentListTasks.map((task) => (
                  <TaskRow key={task.id} task={task} currentTime={currentTime} />
                ))}
              </div>
            </div>
          )}
        </div>

        {filteredTasks.length === 0 && (
          <div className="app-card rounded-3xl border border-dashed p-10 text-center">
            <CheckCircle2 className="mx-auto" size={34} style={{ color: "var(--status-success)" }} />
            <h4 className="mt-3 font-bold">没有符合条件的任务</h4>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStatusFilter("all");
                setTaskTypeFilter("all");
                setCourseFilter("all");
                setQuery("");
              }}
              className="mt-4 rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--primary-foreground)]"
              style={{ backgroundColor: "var(--support)" }}
            >
              清除筛选
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
