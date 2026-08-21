import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  BookText,
  CalendarDays,
  CheckCircle2,
  Flame,
  Headphones,
  Mic,
  Shapes,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { DashboardTitleWithHint } from "./DashboardTitleWithHint";
import { DailyLearningWorkspace } from "./DailyLearningWorkspace";
import { StudentStudyTrendPanel } from "./StudentStudyTrendPanel";

export type GrowthActivityItem = {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  courseTitle: string;
  status: string;
  progressPercent: number;
  lastViewedAt: string;
  href: string | null;
};

export type GrowthReminderItem = {
  id: string;
  kind: "teacher_reply" | "required_resource";
  title: string;
  subtitle: string;
  href: string | null;
};

export type GrowthCourseProgressItem = {
  courseId: string;
  title: string;
  teacherName: string | null;
  completedCount: number;
  totalCount: number;
  percent: number;
  href: string | null;
};

export type GrowthWeekActivityDay = {
  dateString: string;
  minutes: number;
  completedCount: number;
};

type StudyRangeData = {
  label: string;
  values: number[];
  tips: string[];
  totalMinutes: number;
  maxMinutes: number;
  xLabelUnit?: string;
};

type Props = {
  dashboardBasePath: string;
  studentName: string;
  greeting: string;
  hero: GrowthActivityItem | null;
  heroHref: string | null;
  heroLessonProgress: number;
  heroCourseProgress: GrowthCourseProgressItem | null;
  reminders: GrowthReminderItem[];
  recentActivity: GrowthActivityItem[];
  courseProgressList: GrowthCourseProgressItem[];
  weekActivityDays: GrowthWeekActivityDay[];
  completedLessonsCount: number;
  inProgressLessonsCount: number;
  thisWeekCompletedCount: number;
  streakDays: number;
  todayStudyMinutes: number;
  recentSevenDayStudyMinutes: number;
  recentSevenDayActiveDays: number;
  vocabularyThisWeekMinutes: number;
  coursesHref: string;
  toolboxHref: string;
  vocabularyHref: string;
  recordsHref: string;
  monthStudy: StudyRangeData;
  yearStudy: StudyRangeData;
  dailyLearningTasks: HomeLearningTask[];
  requiredTodayTasks: HomeLearningTask[];
  dailyLearningLoadFailed: boolean;
  dailyLearningNowISOString: string;
  assignmentsHref: string;
  coursePracticeHref: string;
  reviewHref: string;
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

function formatWeekday(dateString: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function SystemProgress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="app-muted-text">{label}</span>
        <span className="tabular-nums">{safeValue}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]"
        role="progressbar"
        aria-label={`${label} ${safeValue}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <span
          className="block h-full rounded-full bg-[var(--primary)]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

export function SystemGrowthHomeView({
  dashboardBasePath,
  studentName,
  greeting,
  reminders,
  recentActivity,
  courseProgressList,
  weekActivityDays,
  completedLessonsCount,
  inProgressLessonsCount,
  thisWeekCompletedCount,
  streakDays,
  todayStudyMinutes,
  recentSevenDayStudyMinutes,
  recentSevenDayActiveDays,
  vocabularyThisWeekMinutes,
  coursesHref,
  toolboxHref,
  vocabularyHref,
  recordsHref,
  monthStudy,
  yearStudy,
  dailyLearningTasks,
  requiredTodayTasks,
  dailyLearningLoadFailed,
  dailyLearningNowISOString,
  assignmentsHref,
  coursePracticeHref,
  reviewHref,
}: Props) {
  const visibleCourses = courseProgressList.slice(0, 3);
  const secondaryRecentActivity = recentActivity.slice(1, 4);
  const primaryReminder = reminders[0] ?? null;
  const weeklyGoalPercent = Math.min(
    100,
    Math.round((recentSevenDayActiveDays / 5) * 100),
  );

  const metrics = [
    {
      label: "正在学习",
      value: `${inProgressLessonsCount} 个课时`,
      note: inProgressLessonsCount > 0 ? "从上次位置继续即可" : "选择一节新课开始学习",
      icon: BookOpen,
      color: "var(--primary)",
      soft: "var(--accent)",
    },
    {
      label: "累计完成",
      value: `${completedLessonsCount} 个课时`,
      note: "来自课程学习进度",
      icon: Trophy,
      color: "var(--status-success)",
      soft: "var(--status-success-surface)",
    },
    {
      label: "本周完成",
      value: `${thisWeekCompletedCount} 个课时`,
      note: "按首尔时间周一重新统计",
      icon: CheckCircle2,
      color: "var(--support)",
      soft: "var(--support-surface)",
    },
    {
      label: "本周目标",
      value: `${weeklyGoalPercent}%`,
      note: `目标每周学习 5 天，已完成 ${recentSevenDayActiveDays} 天`,
      icon: Target,
      color: "var(--status-warning)",
      soft: "var(--status-warning-surface)",
    },
  ];

  const reminderContent = primaryReminder ? (
    <span className="flex min-h-16 items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
        <BellRing size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-bold">{primaryReminder.title}</strong>
        <span className="app-muted-text mt-1 block truncate text-xs font-medium">
          {primaryReminder.subtitle}
          {reminders.length > 1 ? `，另有 ${reminders.length - 1} 条老师回复` : ""}
        </span>
      </span>
      <span className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--primary)] px-3 text-xs font-semibold text-white">
        查看回复
        <ArrowRight size={14} aria-hidden="true" />
      </span>
    </span>
  ) : null;

  const studyRanges = [
    {
      id: "week" as const,
      label: "近 7 天",
      periodLabel: "最近 7 天",
      values: weekActivityDays.map((day) => day.minutes),
      axisLabels: weekActivityDays.map((day) => formatWeekday(day.dateString)),
      tips: weekActivityDays.map(
        (day) => `${formatShortDate(day.dateString)} · ${formatMinutes(day.minutes)} · 完成 ${day.completedCount} 个课时`,
      ),
    },
    {
      id: "month" as const,
      label: "本月",
      periodLabel: monthStudy.label,
      values: monthStudy.values,
      axisLabels: monthStudy.values.map((_, index) => `${index + 1}日`),
      tips: monthStudy.tips,
    },
    {
      id: "year" as const,
      label: "今年",
      periodLabel: yearStudy.label,
      values: yearStudy.values,
      axisLabels: yearStudy.values.map((_, index) => `${index + 1}月`),
      tips: yearStudy.tips,
    },
  ];

  const practiceEntries = [
    {
      label: "单词练习",
      description: vocabularyThisWeekMinutes > 0
        ? `本周已练习 ${vocabularyThisWeekMinutes} 分钟`
        : "核心词语与语境搭配",
      href: vocabularyHref,
      icon: BookText,
      color: "var(--primary)",
      soft: "var(--accent)",
    },
    {
      label: "口语练习",
      description: "情境表达与朗读模仿",
      href: `${toolboxHref}/speaking`,
      icon: Mic,
      color: "var(--status-warning)",
      soft: "var(--status-warning-surface)",
    },
    {
      label: "语法练习",
      description: "句型结构与语言运用",
      href: `${toolboxHref}/grammar`,
      icon: Shapes,
      color: "var(--support)",
      soft: "var(--support-surface)",
    },
    {
      label: "听力练习",
      description: "听音辨义与关键信息",
      href: `${toolboxHref}/listening`,
      icon: Headphones,
      color: "var(--status-success)",
      soft: "var(--status-success-surface)",
    },
  ];

  return (
    <div className="software-growth-home px-4 pb-10 pt-4 sm:px-6 sm:pt-5 xl:px-7">
      <h2 className="sr-only">成长首页</h2>

      <section className="student-system-welcome" aria-labelledby="growth-welcome-title">
        <div className="student-system-welcome-main">
          <span className="student-system-welcome-icon" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <div className="min-w-0">
            <span className="student-system-welcome-eyebrow">今日学习</span>
            <h2 id="growth-welcome-title">{greeting}，{studentName}</h2>
            <p>
              {todayStudyMinutes > 0
                ? `今天已留下 ${formatMinutes(todayStudyMinutes)} 的有效学习记录。`
                : "从当前课程继续，今天的学习记录会自动汇总。"}
            </p>
          </div>
        </div>

        <div className="student-system-welcome-summary">
          <span className="student-system-welcome-status">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>
              <small>学习节奏</small>
              <strong>{recentSevenDayStudyMinutes > 0 ? "持续积累中" : "等待开始"}</strong>
            </span>
          </span>
          <span className="student-system-welcome-streak">
            <Flame size={14} aria-hidden="true" />
            {streakDays > 0 ? `连续学习 ${streakDays} 天` : "今天开始积累"}
          </span>
        </div>
      </section>

      <DailyLearningWorkspace
        tasks={dailyLearningTasks}
        requiredTodayTasks={requiredTodayTasks}
        loadFailed={dailyLearningLoadFailed}
        nowISOString={dailyLearningNowISOString}
        reloadHref={dashboardBasePath}
        coursesHref={coursesHref}
        assignmentsHref={assignmentsHref}
        coursePracticeHref={coursePracticeHref}
        specializedPracticeHref={toolboxHref}
        reviewHref={reviewHref}
      />

      {secondaryRecentActivity.length > 0 && (
        <section className="app-card mt-4 rounded-2xl border p-5" aria-labelledby="recent-learning-title">
          <header className="flex items-start justify-between gap-3">
            <h2 id="recent-learning-title" className="text-base font-bold tracking-tight">
              最近学习位置
            </h2>
            <Link
              href={coursesHref}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-[var(--primary-hover)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              全部课程 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>
          <div className="mt-3 divide-y divide-[var(--border-subtle)]">
            {secondaryRecentActivity.map((item) => {
              const content = (
                <span className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--surface-soft)]">
                  <BookOpen size={16} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-semibold">{item.lessonTitle}</strong>
                    <span className="app-muted-text mt-1 block truncate text-xs font-medium">{item.courseTitle}</span>
                  </span>
                  <span className="app-muted-text shrink-0 text-xs font-medium">
                    <LocalDateTime value={item.lastViewedAt} options={DATE_OPTIONS} />
                  </span>
                </span>
              );

              return item.href ? (
                <Link
                  key={item.lessonId}
                  href={scopeDashboardPath(item.href, dashboardBasePath)}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {content}
                </Link>
              ) : (
                <div key={item.lessonId}>{content}</div>
              );
            })}
          </div>
        </section>
      )}

      {primaryReminder && reminderContent && (
        primaryReminder.href ? (
          primaryReminder.kind === "teacher_reply" ? (
            <form
              action={scopeDashboardPath(primaryReminder.href, dashboardBasePath)}
              method="post"
              className="app-card mt-3 overflow-hidden rounded-2xl border"
            >
              <button type="submit" className="block w-full cursor-pointer text-left">
                {reminderContent}
              </button>
            </form>
          ) : (
            <Link
              href={scopeDashboardPath(primaryReminder.href, dashboardBasePath)}
              className="app-card mt-3 block overflow-hidden rounded-2xl border"
            >
              {reminderContent}
            </Link>
          )
        ) : (
          <div className="app-card mt-3 overflow-hidden rounded-2xl border">{reminderContent}</div>
        )
      )}

      <div className="mt-4">
        <section className="app-card min-w-0 rounded-2xl border p-5" aria-labelledby="study-trend-title">
          <StudentStudyTrendPanel ranges={studyRanges} />
          <div className="mt-4 flex flex-wrap items-start gap-3 rounded-xl bg-[var(--surface-soft)] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary-hover)]">
              <CalendarDays size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block text-xs font-semibold">最近 7 天学习建议</strong>
              <p className="app-muted-text mt-1 text-xs font-medium leading-5">
                {recentSevenDayStudyMinutes === 0
                  ? "还没有有效学习记录。完成一次短学习后，系统会从真实数据开始分析。"
                  : recentSevenDayActiveDays >= 5
                    ? "学习节奏稳定。建议优先完成正在进行的章节，保持当前连续性。"
                    : `已有 ${recentSevenDayActiveDays} 天有效学习。把学习分散到更多天，比单日集中更容易保持。`}
              </p>
            </div>
            <Link href={recordsHref} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-[var(--primary-hover)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              学习记录 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-labelledby="growth-metrics-title">
        <h2 id="growth-metrics-title" className="sr-only">学习数据概览</h2>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="app-card rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="app-muted-text text-xs font-semibold">{metric.label}</p>
                  <p className="mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{metric.value}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ color: metric.color, backgroundColor: metric.soft }}>
                  <Icon size={17} aria-hidden="true" />
                </span>
              </div>
              <p className="app-muted-text mt-3 text-xs font-medium leading-5">{metric.note}</p>
            </article>
          );
        })}
      </section>

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-12">
        <section className="app-card min-w-0 rounded-2xl border p-5 xl:col-span-8" aria-labelledby="course-progress-title">
          <header className="flex items-start justify-between gap-3">
            <h2 id="course-progress-title" className="text-base font-bold tracking-tight">课程进度</h2>
            <Link href={coursesHref} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-[var(--primary-hover)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              查看全部 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>

          {visibleCourses.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {visibleCourses.map((course) => (
                <div
                  key={course.courseId}
                  className="relative rounded-xl border border-[var(--border-subtle)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--surface-soft)]"
                >
                  <Link
                    href={course.href ? scopeDashboardPath(course.href, dashboardBasePath) : coursesHref}
                    className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    aria-label={!course.href ? `${course.title}入口待完善，前往课程目录` : course.title}
                  />
                  <div className="pointer-events-none relative">
                    <div className="flex items-start justify-between gap-2">
                      <BookOpen size={18} className="text-[var(--primary)]" aria-hidden="true" />
                      {!course.href && (
                        <span className="rounded-full bg-[var(--status-warning-surface)] px-2 py-1 text-xs font-semibold text-[var(--status-warning)]">入口待完善</span>
                      )}
                    </div>
                    <DashboardTitleWithHint
                      className="mb-4 mt-3"
                      title={course.title}
                      description={course.href
                        ? course.teacherName ? `${course.teacherName} 老师` : "自主学习课程"
                        : "课程仍保留显示，可从课程目录继续查找"}
                      headingLevel={3}
                      hintClassName="pointer-events-auto relative z-10"
                      titleClassName="min-h-10 text-sm font-bold leading-5"
                    />
                    <SystemProgress value={course.percent} label={`${course.completedCount}/${course.totalCount} 课时`} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
              <BookOpen size={24} className="text-[var(--foreground-muted)]" aria-hidden="true" />
              <DashboardTitleWithHint
                className="mt-3 items-center"
                title="还没有课程进度"
                description="进入课程学习后，这里会形成你的课程地图。"
                headingLevel={3}
                titleClassName="text-sm font-bold"
              />
              <Link href={coursesHref} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)]">
                浏览课程
              </Link>
            </div>
          )}
        </section>

        <section className="app-card min-w-0 rounded-2xl border p-5 xl:col-span-4" aria-labelledby="growth-tools-title">
          <header>
            <h2 id="growth-tools-title" className="text-base font-bold tracking-tight">专项训练入口</h2>
          </header>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {practiceEntries.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.label}
                  href={entry.href}
                  className="group min-h-28 rounded-xl border border-[var(--border-subtle)] p-3 transition hover:border-[var(--primary)] hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: entry.color, backgroundColor: entry.soft }}>
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <strong className="mt-3 block text-xs font-bold">{entry.label}</strong>
                  <p className="app-muted-text mt-1 text-xs font-medium leading-5">{entry.description}</p>
                </Link>
              );
            })}
          </div>
          <Link href={toolboxHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
            查看全部专项训练 <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>
      </div>

    </div>
  );
}
