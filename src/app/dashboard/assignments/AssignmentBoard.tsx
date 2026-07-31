"use client";

import Link from "next/link";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FilePenLine,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import {
  ASSIGNMENT_TYPE_LABELS,
  formatAssignmentDate,
  type AssignmentType,
  type SubmissionStatus,
} from "./config";

type BoardItem = {
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

type ViewStatus =
  | "pending"
  | "submitted"
  | "graded"
  | "revision_required"
  | "upcoming"
  | "overdue"
  | "preview";

type StatusFilter = "all" | "todo" | "submitted" | "graded";
type TaskTypeFilter = "all" | "homework" | "exam";

const statusPresentation: Record<
  ViewStatus,
  { label: string; color: string; soft: string }
> = {
  pending: {
    label: "待完成",
    color: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
  },
  submitted: {
    label: "已提交 · 待批改",
    color: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
  },
  graded: {
    label: "已出分",
    color: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
  revision_required: {
    label: "需修改",
    color: "#c94f45",
    soft: "#fff0ed",
  },
  upcoming: {
    label: "即将开始",
    color: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  overdue: {
    label: "已截止",
    color: "#8b5d56",
    soft: "#f7eeec",
  },
  preview: {
    label: "学生端预览",
    color: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
};

function getViewStatus(
  item: BoardItem,
  isManager: boolean,
  now: number
): ViewStatus {
  if (isManager) {
    return new Date(item.due_at).getTime() < now ? "overdue" : "preview";
  }

  if (item.latestSubmission) return item.latestSubmission.status;
  if (new Date(item.starts_at).getTime() > now) return "upcoming";
  return new Date(item.due_at).getTime() < now ? "overdue" : "pending";
}

function getDeadlineText(date: string, now: number) {
  const difference = new Date(date).getTime() - now;
  const days = Math.ceil(difference / 86_400_000);

  if (difference < 0) return "已截止";
  if (days === 0) return "今天截止";
  if (days === 1) return "明天截止";
  if (days <= 7) return `${days} 天后截止`;
  return formatAssignmentDate(date);
}

export function AssignmentBoard({
  items,
  isManager,
  currentTime,
}: {
  items: BoardItem[];
  isManager: boolean;
  currentTime: number;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [taskTypeFilter, setTaskTypeFilter] =
    useState<TaskTypeFilter>("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [query, setQuery] = useState("");
  const now = currentTime;

  const itemsWithStatus = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        viewStatus: getViewStatus(item, isManager, now),
      })),
    [isManager, items, now]
  );

  const courseGroups = useMemo(
    () =>
      [...new Set(items.map((item) => item.courseGroup))].sort((a, b) =>
        a.localeCompare(b, "zh-CN")
      ),
    [items]
  );

  const counts = {
    todo: itemsWithStatus.filter((item) =>
      ["pending", "revision_required"].includes(item.viewStatus)
    ).length,
    submitted: itemsWithStatus.filter(
      (item) => item.viewStatus === "submitted"
    ).length,
    graded: itemsWithStatus.filter((item) => item.viewStatus === "graded")
      .length,
  };

  const filteredItems = itemsWithStatus.filter((item) => {
    const typeMatches =
      taskTypeFilter === "all" || item.assignment_type === taskTypeFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "todo" &&
        ["pending", "revision_required"].includes(item.viewStatus)) ||
      item.viewStatus === statusFilter;
    const courseMatches =
      courseFilter === "all" || item.courseGroup === courseFilter;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const queryMatches =
      !normalizedQuery ||
      `${item.title} ${item.description} ${item.courseTitle}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery);

    return typeMatches && statusMatches && courseMatches && queryMatches;
  });

  const nearestTask = itemsWithStatus.find((item) =>
    ["pending", "revision_required"].includes(item.viewStatus)
  );
  const homeworkCount = items.filter(
    (item) => item.assignment_type === "homework"
  ).length;
  const examCount = items.filter(
    (item) => item.assignment_type === "exam"
  ).length;

  const filters: Array<{
    value: StatusFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "全部任务", count: items.length },
    { value: "todo", label: "待完成", count: counts.todo },
    { value: "submitted", label: "待批改", count: counts.submitted },
    { value: "graded", label: "已完成", count: counts.graded },
  ];

  return (
    <>
      <section
        className="app-card relative overflow-hidden rounded-[2rem] border p-5 sm:p-7"
        style={{
          background:
            "linear-gradient(130deg, var(--app-hero-end), var(--app-card-bg) 54%, var(--app-secondary-soft))",
        }}
      >
        <div
          className="absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-70 blur-3xl"
          style={{ backgroundColor: "var(--app-accent-soft)" }}
        />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
              style={{
                color: "var(--app-secondary)",
                backgroundColor: "var(--app-secondary-soft)",
              }}
            >
              <ClipboardCheck size={15} />
              {isManager ? "学生端任务预览" : "我的作业与考试"}
            </span>
            <DashboardTitleWithHint className="mt-4" titleClassName="max-w-3xl text-2xl font-black tracking-tight sm:text-3xl" title="课程测试、老师作业、正式考试，分开处理" description="学完章节后进入课程测试进行自测；作业和考试由老师发布，按截止时间完成。选校、材料、签证等留学服务事项不会进入本页。" />

            {nearestTask && !isManager && (
              <Link
                href={`/dashboard/assignments/${nearestTask.id}`}
                className="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
                style={{ backgroundColor: "var(--app-secondary)" }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Sparkles size={16} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[10px] opacity-75">建议下一步</span>
                  <span className="block truncate">{nearestTask.title}</span>
                </span>
                <ArrowRight className="shrink-0" size={16} />
              </Link>
            )}
          </div>

          <div className="dashboard-title-metrics">
            {[
              ["待完成", counts.todo, FilePenLine, "var(--app-accent)", "var(--app-accent-soft)"],
              ["待批改", counts.submitted, Clock3, "var(--app-warm)", "var(--app-warm-soft)"],
              ["已出分", counts.graded, Award, "var(--app-success)", "var(--app-success-soft)"],
            ].map(([label, value, Icon, color, soft]) => {
              const MetricIcon = Icon as typeof Award;
              return (
                <div
                  key={String(label)}
                  className="app-card rounded-2xl border p-3 text-center sm:p-4"
                >
                  <span
                    className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      color: String(color),
                      backgroundColor: String(soft),
                    }}
                  >
                    <MetricIcon size={17} />
                  </span>
                  <p className="mt-2 text-2xl font-black">{String(value)}</p>
                  <p className="app-muted-text text-[11px] font-black">
                    {String(label)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 px-1">
          <p className="text-xs font-black" style={{ color: "var(--app-accent)" }}>
            选择学习入口
          </p>
          <h2 className="mt-1 text-xl font-black">你现在要做哪一类事情？</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Link
            href="/dashboard/assignments/korean"
            className="app-card group relative overflow-hidden rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg"
            style={{
              background:
                "linear-gradient(140deg, var(--app-card-bg), var(--app-secondary-soft))",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <BookOpenCheck size={22} />
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-black"
                style={{
                  color: "var(--app-success)",
                  backgroundColor: "var(--app-success-soft)",
                }}
              >
                学完即测
              </span>
            </div>
            <p className="mt-5 text-xs font-black" style={{ color: "var(--app-secondary)" }}>
              入口 01
            </p>
            <DashboardTitleWithHint
              className="mt-1"
              headingLevel={3}
              titleClassName="text-xl font-black"
              title="章节测试"
              description="跟随课程进度开放，用来检验知识点；不是老师布置的作业，也不是正式考试。"
            />
            <span
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-black"
              style={{ color: "var(--app-secondary)" }}
            >
              进入测试中心
              <ArrowRight
                className="transition group-hover:translate-x-1"
                size={14}
              />
            </span>
          </Link>

          <a
            href="#task-list"
            onClick={() => {
              setTaskTypeFilter("homework");
              setStatusFilter("all");
            }}
            className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  color: "var(--app-accent)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <FilePenLine size={22} />
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-black"
                style={{
                  color: "var(--app-accent)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                {homeworkCount} 项
              </span>
            </div>
            <p className="mt-5 text-xs font-black" style={{ color: "var(--app-accent)" }}>
              入口 02
            </p>
            <DashboardTitleWithHint
              className="mt-1"
              headingLevel={3}
              titleClassName="text-xl font-black"
              title="老师作业"
              description="由老师发布，有提交要求和截止时间；提交后等待老师批改或退回修改。"
            />
            <span
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-black"
              style={{ color: "var(--app-accent)" }}
            >
              查看全部作业
              <ArrowRight
                className="transition group-hover:translate-x-1"
                size={14}
              />
            </span>
          </a>

          <a
            href="#task-list"
            onClick={() => {
              setTaskTypeFilter("exam");
              setStatusFilter("all");
            }}
            className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  color: "var(--app-warm)",
                  backgroundColor: "var(--app-warm-soft)",
                }}
              >
                <ClipboardCheck size={22} />
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-black"
                style={{
                  color: "var(--app-warm)",
                  backgroundColor: "var(--app-warm-soft)",
                }}
              >
                {examCount} 场
              </span>
            </div>
            <p className="mt-5 text-xs font-black" style={{ color: "var(--app-warm)" }}>
              入口 03
            </p>
            <DashboardTitleWithHint
              className="mt-1"
              headingLevel={3}
              titleClassName="text-xl font-black"
              title="正式考试"
              description="由老师发布，强调考试时间、限时和交卷规则；与日常章节自测完全分开。"
            />
            <span
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-black"
              style={{ color: "var(--app-warm)" }}
            >
              查看考试安排
              <ArrowRight
                className="transition group-hover:translate-x-1"
                size={14}
              />
            </span>
          </a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-accent)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              <BookOpenCheck size={20} />
            </span>
            <div>
              <DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-black" title={<>这里会出现哪些课程？</>} description={<>章节测试跟随“我的课程”进度；老师发布的作业和考试按韩语、
                英语、数学或大学课程自动归类。未关联课程的内容归为“综合任务”。</>} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {courseGroups.length > 0 ? (
              courseGroups.map((group) => (
                <span
                  key={group}
                  className="rounded-full border px-3 py-1.5 text-xs font-black"
                  style={{
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
                    borderColor: "var(--app-border-soft)",
                  }}
                >
                  {group}
                </span>
              ))
            ) : (
              <span className="app-muted-text text-xs">暂无课程任务</span>
            )}
          </div>
        </div>

        <div className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-success)",
                backgroundColor: "var(--app-success-soft)",
              }}
            >
              <ShieldCheck size={20} />
            </span>
            <div>
              <DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-black" title={<>留学服务已排除</>} description={<>申请规划、材料清单、院校方案和签证跟进不属于课程考核，
                请继续在对应的留学服务板块处理。</>} />
            </div>
          </div>
        </div>
      </section>

      <section id="task-list" className="app-card scroll-mt-5 rounded-3xl border p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "全部"],
              ["homework", "只看作业"],
              ["exam", "只看考试"],
            ].map(([value, label]) => {
              const active = taskTypeFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTaskTypeFilter(value as TaskTypeFilter)}
                  className="rounded-xl px-3 py-2.5 text-xs font-black transition"
                  style={{
                    color: active ? "white" : "var(--app-muted)",
                    backgroundColor: active
                      ? "var(--app-secondary)"
                      : "var(--app-soft-bg)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => {
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition"
                  style={{
                    color: active ? "white" : "var(--app-muted)",
                    backgroundColor: active
                      ? "var(--app-secondary)"
                      : "var(--app-soft-bg)",
                  }}
                >
                  {filter.label}
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: active
                        ? "rgba(255,255,255,.18)"
                        : "var(--app-card-bg)",
                    }}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[560px]">
            <label className="relative">
              <span className="sr-only">搜索任务</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 app-muted-text"
                size={15}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索作业、考试或课程"
                className="app-input w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs"
              />
            </label>
            <label>
              <span className="sr-only">按课程分类筛选</span>
              <select
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value)}
                className="app-input w-full rounded-xl border px-3 py-2.5 text-xs font-bold"
              >
                <option value="all">全部课程分类</option>
                {courseGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <DashboardTitleWithHint
            headingLevel={2}
            titleClassName="text-xl font-black"
            title="任务清单"
            description={
              <>
                {taskTypeFilter === "homework"
                  ? "老师发布的作业"
                  : taskTypeFilter === "exam"
                    ? "老师发布的考试"
                    : "老师发布的作业与考试"}
                · 当前显示 {filteredItems.length} 项
              </>
            }
          />
          <ClipboardList
            size={23}
            style={{ color: "var(--app-accent)" }}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredItems.map((item) => {
            const presentation = statusPresentation[item.viewStatus];
            const isUrgent =
              ["pending", "revision_required"].includes(item.viewStatus) &&
              new Date(item.due_at).getTime() - now <= 3 * 86_400_000;

            return (
              <Link
                key={item.id}
                href={`/dashboard/assignments/${item.id}`}
                className="app-card group flex min-h-[300px] flex-col rounded-[1.75rem] border p-5 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-black"
                    style={{
                      color: "var(--app-secondary)",
                      backgroundColor: "var(--app-secondary-soft)",
                    }}
                  >
                    {ASSIGNMENT_TYPE_LABELS[item.assignment_type]}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-black"
                    style={{
                      color: presentation.color,
                      backgroundColor: presentation.soft,
                    }}
                  >
                    {presentation.label}
                  </span>
                  <ChevronRight
                    className="ml-auto transition group-hover:translate-x-1"
                    size={18}
                    style={{ color: "var(--app-muted)" }}
                  />
                </div>

                <div className="mt-4">
                  <p
                    className="text-[11px] font-black"
                    style={{ color: "var(--app-accent)" }}
                  >
                    {item.courseGroup} · {item.courseTitle}
                  </p>
                  <h3 className="mt-2 text-lg font-black leading-7">
                    {item.title}
                  </h3>
                  <p className="app-muted-text mt-2 line-clamp-2 text-xs leading-5">
                    {item.description || "打开任务查看完整要求与作答内容。"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold app-muted-text">
                  <span
                    className="rounded-lg px-2.5 py-1.5"
                    style={{ backgroundColor: "var(--app-soft-bg)" }}
                  >
                    {item.total_points} 分
                  </span>
                  {item.duration_minutes && (
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5"
                      style={{ backgroundColor: "var(--app-soft-bg)" }}
                    >
                      <Timer size={11} />
                      约 {item.duration_minutes} 分钟
                    </span>
                  )}
                  {item.allow_resubmission && (
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5"
                      style={{ backgroundColor: "var(--app-soft-bg)" }}
                    >
                      <RotateCcw size={11} />
                      可再次提交
                    </span>
                  )}
                </div>

                <div
                  className="mt-auto flex items-end justify-between gap-4 border-t pt-4"
                  style={{ borderColor: "var(--app-border-soft)" }}
                >
                  <div>
                    <p
                      className="flex items-center gap-1.5 text-xs font-black"
                      style={{
                        color: isUrgent ? "#c94f45" : "var(--app-foreground)",
                      }}
                    >
                      {isUrgent ? (
                        <AlertCircle size={13} />
                      ) : (
                        <Clock3 size={13} />
                      )}
                      {item.viewStatus === "upcoming"
                        ? `开始 ${formatAssignmentDate(item.starts_at)}`
                        : getDeadlineText(item.due_at, now)}
                    </p>
                    <p className="app-muted-text mt-1 text-[10px]">
                      {formatAssignmentDate(item.due_at)}
                    </p>
                  </div>

                  {item.viewStatus === "graded" ? (
                    <p
                      className="text-2xl font-black"
                      style={{ color: "var(--app-success)" }}
                    >
                      {item.latestSubmission?.score ?? 0}
                      <span className="ml-1 text-[10px] app-muted-text">
                        / {item.total_points}
                      </span>
                    </p>
                  ) : item.viewStatus === "revision_required" ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-black"
                      style={{ color: "#c94f45" }}
                    >
                      <RotateCcw size={13} />
                      查看反馈
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-black"
                      style={{ color: "var(--app-secondary)" }}
                    >
                      {item.viewStatus === "pending"
                        ? "开始作答"
                        : item.viewStatus === "upcoming"
                          ? "查看安排"
                          : "查看详情"}
                      <ArrowRight size={13} />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="app-card rounded-[1.75rem] border border-dashed p-10 text-center">
            <CheckCircle2
              className="mx-auto"
              size={36}
              style={{ color: "var(--app-success)" }}
            />
            <div className="mt-4 flex justify-center">
              <DashboardTitleWithHint
                headingLevel={3}
                titleClassName="font-black"
                title={
                  items.length === 0
                    ? "当前没有课程作业或考试"
                    : "没有符合筛选条件的任务"
                }
                description={
                  items.length === 0
                    ? "老师发布新的教学任务后会自动显示在这里。"
                    : "可以切换状态、课程分类，或清空搜索关键词。"
                }
              />
            </div>
            {items.length > 0 && (
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
            )}
          </div>
        )}
      </section>
    </>
  );
}
