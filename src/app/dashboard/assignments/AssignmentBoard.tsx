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
  Sparkles,
  Timer,
} from "lucide-react";

import {
  formatAssignmentDate,
  type AssignmentType,
  type SubmissionStatus,
} from "./config";

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
  | "preview";
type StatusFilter = "all" | "todo" | "revision" | "submitted" | "completed";
type TaskTypeFilter = "all" | TaskKind;

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
};

const kindPresentation = {
  chapter_test: {
    label: "章节测试",
    shortLabel: "课后练习",
    icon: BookOpenCheck,
    color: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  homework: {
    label: "老师作业",
    shortLabel: "需提交",
    icon: FilePenLine,
    color: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
  },
  exam: {
    label: "正式考试",
    shortLabel: "限时",
    icon: ClipboardCheck,
    color: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
  },
} satisfies Record<
  TaskKind,
  { label: string; shortLabel: string; icon: typeof BookOpenCheck; color: string; soft: string }
>;

const statePresentation: Record<TaskState, { label: string; color: string; soft: string }> = {
  pending: { label: "待完成", color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
  revision_required: { label: "需修改", color: "#c94f45", soft: "#fff0ed" },
  submitted: { label: "待批改", color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  graded: { label: "已完成", color: "var(--app-success)", soft: "var(--app-success-soft)" },
  upcoming: { label: "未开放", color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  overdue: { label: "已截止", color: "#8b5d56", soft: "#f7eeec" },
  preview: { label: "学生端预览", color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
};

function getAssignmentState(item: AssignmentItem, isManager: boolean, now: number): TaskState {
  if (isManager) return new Date(item.due_at).getTime() < now ? "overdue" : "preview";
  if (item.latestSubmission) return item.latestSubmission.status;
  if (new Date(item.starts_at).getTime() > now) return "upcoming";
  return new Date(item.due_at).getTime() < now ? "overdue" : "pending";
}

function getDeadlineLabel(task: UnifiedTask, now: number) {
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
  if (task.state === "revision_required") return task.kind === "chapter_test" ? "重新测试" : "查看反馈";
  if (task.state === "pending") return task.kind === "chapter_test" ? "开始测试" : "开始作答";
  if (task.state === "upcoming") return "查看安排";
  if (task.state === "submitted") return "查看提交";
  if (task.state === "graded") return task.kind === "chapter_test" ? "查看成绩" : "查看批改";
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
  };
  const stateDifference = rank[a.state] - rank[b.state];
  if (stateDifference !== 0) return stateDifference;

  const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return (a.chapterNumber ?? 999) - (b.chapterNumber ?? 999);
}

export function AssignmentBoard({
  items,
  chapterTests,
  isManager,
  currentTime,
}: {
  items: AssignmentItem[];
  chapterTests: ChapterTestItem[];
  isManager: boolean;
  currentTime: number;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [query, setQuery] = useState("");

  const tasks = useMemo<UnifiedTask[]>(() => {
    const assignmentTasks = items.map<UnifiedTask>((item) => ({
      id: item.id,
      href: `/dashboard/assignments/${item.id}`,
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
    }));

    const testTasks = chapterTests.map<UnifiedTask>((test) => ({
      id: `chapter-test-${test.id}`,
      href: `/dashboard/assignments/korean/${test.slug}`,
      kind: "chapter_test",
      state: isManager
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

  const nextTask = tasks.find((task) =>
    ["revision_required", "pending"].includes(task.state)
  );

  const filteredTasks = tasks.filter((task) => {
    const typeMatches = taskTypeFilter === "all" || task.kind === taskTypeFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "todo" && ["pending", "upcoming"].includes(task.state)) ||
      (statusFilter === "revision" && task.state === "revision_required") ||
      (statusFilter === "submitted" && task.state === "submitted") ||
      (statusFilter === "completed" && task.state === "graded");
    const courseMatches = courseFilter === "all" || task.courseGroup === courseFilter;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const queryMatches =
      !normalizedQuery ||
      `${task.title} ${task.description} ${task.courseTitle}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery);
    return typeMatches && statusMatches && courseMatches && queryMatches;
  });

  const statusFilters: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: "全部", count: tasks.length },
    { value: "todo", label: "待完成", count: counts.todo },
    { value: "revision", label: "需修改", count: counts.revision },
    { value: "submitted", label: "待批改", count: counts.submitted },
    { value: "completed", label: "已完成", count: counts.completed },
  ];

  return (
    <div className="space-y-4">
      {isManager && <section
        className="app-card overflow-hidden rounded-[2rem] border p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(130deg, var(--app-hero-end), var(--app-card-bg) 56%, var(--app-secondary-soft))",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {isManager && (
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
              >
                <ClipboardCheck size={15} />
                学生端任务预览
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-tight">学习任务</h1>
            </div>
          )}

          <div className={`grid grid-cols-3 gap-2 ${isManager ? "sm:min-w-[360px]" : "w-full"}`}>
            {[
              ["待完成", counts.todo, FilePenLine, "var(--app-accent)", "var(--app-accent-soft)"],
              ["需修改", counts.revision, RotateCcw, "#c94f45", "#fff0ed"],
              ["已完成", counts.completed, Award, "var(--app-success)", "var(--app-success-soft)"],
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
                    <p className="text-xl font-black leading-none">{String(value)}</p>
                    <p className="app-muted-text mt-1 text-[10px] font-black">{String(label)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>}

      {!isManager && (
        nextTask ? (
          <section className="app-card rounded-3xl border p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
              >
                <Sparkles size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black" style={{ color: "var(--app-secondary)" }}>下一项</p>
                <h2 className="mt-1 truncate text-lg font-black">{nextTask.title}</h2>
                <div className="app-muted-text mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
                  <span>{nextTask.courseTitle}</span>
                  <span>{kindPresentation[nextTask.kind].label}</span>
                  <span>{getDeadlineLabel(nextTask, currentTime)}</span>
                </div>
              </div>
              <Link
                href={nextTask.href}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white"
                style={{ backgroundColor: "var(--app-secondary)" }}
              >
                {getActionLabel(nextTask)}
                <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        ) : (
          <section className="app-card flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center">
            <CheckCircle2 size={34} style={{ color: "var(--app-success)" }} />
            <div className="flex-1">
              <h2 className="font-black">当前没有待完成任务</h2>
              <p className="app-muted-text mt-1 text-xs font-bold">可以继续课程学习，新的任务会自动出现在这里。</p>
            </div>
            <Link
              href="/dashboard/courses"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              继续学习 <ArrowRight size={13} />
            </Link>
          </section>
        )
      )}

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(kindPresentation) as TaskKind[]).map((kind) => {
          const item = kindPresentation[kind];
          const Icon = item.icon;
          const active = taskTypeFilter === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setTaskTypeFilter(active ? "all" : kind)}
              className="app-card flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5"
              style={{ outline: active ? `2px solid ${item.color}` : undefined }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ color: item.color, backgroundColor: item.soft }}
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black">{item.label}</span>
                <span className="app-muted-text mt-0.5 block text-[10px] font-black">{item.shortLabel}</span>
              </span>
              <span className="text-xl font-black" style={{ color: item.color }}>{typeCounts[kind]}</span>
            </button>
          );
        })}
      </section>

      <section id="task-list" className="app-card scroll-mt-5 rounded-3xl border p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((filter) => {
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition"
                  style={{
                    color: active ? "white" : "var(--app-muted)",
                    backgroundColor: active ? "var(--app-secondary)" : "var(--app-soft-bg)",
                  }}
                >
                  {filter.label}
                  <span className="rounded-md px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: active ? "rgba(255,255,255,.18)" : "var(--app-card-bg)" }}>
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>

          {(tasks.length > 6 || courseGroups.length > 1) && (
            <div className="grid gap-2 sm:grid-cols-2 xl:w-[520px]">
              <label className="relative">
                <span className="sr-only">搜索任务</span>
                <Search className="app-muted-text pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索任务或课程"
                  className="app-input w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs"
                />
              </label>
              {courseGroups.length > 1 && (
                <label>
                  <span className="sr-only">按课程筛选</span>
                  <select
                    value={courseFilter}
                    onChange={(event) => setCourseFilter(event.target.value)}
                    className="app-input w-full rounded-xl border px-3 py-2.5 text-xs font-bold"
                  >
                    <option value="all">全部课程</option>
                    {courseGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xl font-black">任务列表</h2>
          <span className="app-muted-text text-xs font-black">{filteredTasks.length} 项</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredTasks.map((task) => {
            const kind = kindPresentation[task.kind];
            const state = statePresentation[task.state];
            const KindIcon = kind.icon;
            const deadlineLabel = getDeadlineLabel(task, currentTime);
            const urgent =
              task.dueAt &&
              ["pending", "revision_required"].includes(task.state) &&
              new Date(task.dueAt).getTime() - currentTime <= 3 * 86_400_000;

            return (
              <Link
                key={task.id}
                href={task.href}
                className="app-card group flex min-h-[210px] flex-col rounded-3xl border p-4 transition hover:-translate-y-1 hover:shadow-lg sm:p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: kind.color, backgroundColor: kind.soft }}>
                    <KindIcon size={12} /> {kind.label}
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: state.color, backgroundColor: state.soft }}>
                    {state.label}
                  </span>
                  <ArrowRight className="ml-auto transition group-hover:translate-x-1" size={16} style={{ color: "var(--app-muted)" }} />
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-black" style={{ color: kind.color }}>{task.courseTitle}</p>
                  <h3 className="mt-1.5 text-lg font-black leading-7">{task.title}</h3>
                  {task.description && <p className="app-muted-text mt-1 line-clamp-1 text-xs font-bold">{task.description}</p>}
                </div>

                <div className="app-muted-text mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                  {task.chapterNumber && <span className="rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--app-soft-bg)" }}>第 {task.chapterNumber} 章</span>}
                  {task.questionCount !== null && <span className="rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--app-soft-bg)" }}>{task.questionCount} 题</span>}
                  {task.durationMinutes && (
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                      <Timer size={11} /> {task.durationMinutes} 分钟
                    </span>
                  )}
                  {task.kind !== "chapter_test" && <span className="rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--app-soft-bg)" }}>{task.totalPoints} 分</span>}
                  {task.allowResubmission && task.kind !== "chapter_test" && (
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                      <RotateCcw size={11} /> 可再次提交
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-end justify-between gap-4 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-black" style={{ color: urgent ? "#c94f45" : "var(--app-foreground)" }}>
                      {urgent ? <AlertCircle size={13} /> : <Clock3 size={13} />}
                      {deadlineLabel}
                    </p>
                    {task.dueAt && <p className="app-muted-text mt-1 text-[10px]">{formatAssignmentDate(task.dueAt)}</p>}
                  </div>

                  {task.score !== null && task.state === "graded" ? (
                    <p className="text-2xl font-black" style={{ color: "var(--app-success)" }}>
                      {task.score}<span className="ml-1 text-[10px] app-muted-text">/ {task.totalPoints}</span>
                    </p>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-black" style={{ color: state.color }}>
                      {getActionLabel(task)} <ArrowRight size={13} />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {filteredTasks.length === 0 && (
          <div className="app-card rounded-3xl border border-dashed p-10 text-center">
            <CheckCircle2 className="mx-auto" size={34} style={{ color: "var(--app-success)" }} />
            <h3 className="mt-3 font-black">没有符合条件的任务</h3>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setTaskTypeFilter("all");
                setCourseFilter("all");
                setQuery("");
              }}
              className="mt-4 rounded-xl px-4 py-2.5 text-xs font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              清除筛选
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
