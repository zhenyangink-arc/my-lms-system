import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  BookText,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Flame,
  GraduationCap,
  LineChart,
  PlayCircle,
  Sparkles,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { MonthlyStudyDialog } from "./MonthlyStudyDialog";

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

type StudyDialogData = {
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
  monthStudy: StudyDialogData;
  yearStudy: StudyDialogData;
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]";

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

function getWeekday(dateString: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function getShortDate(dateString: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function Surface({
  children,
  className = "",
  tone = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "primary" | "hero" | "quiet" | "accent";
}) {
  return (
    <section
      className={`growth-surface growth-surface--${tone} rounded-[20px] border ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            color: "var(--app-accent-strong)",
            backgroundColor: "var(--app-accent-soft)",
          }}
        >
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm leading-6 app-muted-text">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold app-muted-text">
        <span>{label}</span>
        <span className="tabular-nums">{safeValue}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--app-soft-bg)" }}
        role="progressbar"
        aria-label={`${label} ${safeValue}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${safeValue}%`,
            backgroundColor: "var(--app-accent)",
          }}
        />
      </div>
    </div>
  );
}

export function GrowthHomeView({
  dashboardBasePath,
  studentName,
  greeting,
  hero,
  heroHref,
  heroLessonProgress,
  heroCourseProgress,
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
}: Props) {
  const maxWeeklyMinutes = Math.max(
    1,
    ...weekActivityDays.map((day) => day.minutes)
  );
  const hasWeeklyActivity = weekActivityDays.some((day) => day.minutes > 0);
  const bestStudyDay = [...weekActivityDays].sort(
    (a, b) => b.minutes - a.minutes
  )[0];
  const visibleCourses = courseProgressList
    .filter(
      (course): course is GrowthCourseProgressItem & { href: string } =>
        Boolean(course.href)
    )
    .slice(0, 3);

  const stats: {
    label: string;
    value: number;
    suffix: string;
    icon: LucideIcon;
    color: string;
    soft: string;
  }[] = [
    {
      label: "累计完成",
      value: completedLessonsCount,
      suffix: "课时",
      icon: CheckCircle2,
      color: "var(--app-success)",
      soft: "var(--app-success-soft)",
    },
    {
      label: "正在学习",
      value: inProgressLessonsCount,
      suffix: "课时",
      icon: PlayCircle,
      color: "var(--app-accent-strong)",
      soft: "var(--app-accent-soft)",
    },
    {
      label: "本周完成",
      value: thisWeekCompletedCount,
      suffix: "课时",
      icon: CalendarCheck2,
      color: "var(--app-secondary)",
      soft: "var(--app-secondary-soft)",
    },
    {
      label: "连续学习",
      value: streakDays,
      suffix: "天",
      icon: Flame,
      color: "var(--app-warm)",
      soft: "var(--app-warm-soft)",
    },
  ];

  return (
    <div className="growth-home mx-auto w-full max-w-[1380px] px-4 pb-16 pt-5 sm:px-6 sm:pt-7 lg:px-8">
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.75fr)]">
        <Surface tone="hero" className="relative isolate overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="growth-hero-orb absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full blur-3xl"
          />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0">
              <p
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-accent-strong)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <Sparkles size={14} aria-hidden="true" />
                今日成长计划
              </p>
              <h2 className="mt-4 max-w-3xl text-balance text-2xl font-black tracking-tight sm:text-3xl">
                {greeting}，{studentName}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text sm:text-base">
                {hero
                  ? hero.status === "completed"
                    ? "最近课时已经完成。可以复习巩固，也可以从课程目录选择下一步。"
                    : "从上次停下的位置继续，把今天最重要的一步先完成。"
                  : "选择第一门课程，系统会从第一次学习开始记录你的成长。"}
              </p>
            </div>
            <div className="growth-panel growth-panel--quiet flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3">
              <Timer size={19} style={{ color: "var(--app-accent-strong)" }} aria-hidden="true" />
              <div>
                <p className="text-xs font-bold app-muted-text">今日有效学习</p>
                <p className="mt-0.5 text-lg font-black tabular-nums">
                  {formatMinutes(todayStudyMinutes)}
                </p>
              </div>
            </div>
          </div>

          {hero ? (
            <div className="growth-panel growth-panel--raised mt-7 grid gap-6 rounded-[18px] border p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="app-muted-text">{hero.courseTitle}</span>
                  <span aria-hidden="true" className="app-muted-text">·</span>
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{ color: "var(--app-accent-strong)" }}
                  >
                    <Clock3 size={13} aria-hidden="true" />
                    {STATUS_LABELS[hero.status] ?? hero.status}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-black leading-8 sm:text-2xl">
                  {hero.lessonTitle}
                </h3>
                <div className="mt-5 max-w-xl">
                  <ProgressBar value={heroLessonProgress} label="当前课时进度" />
                  {heroCourseProgress && (
                    <p className="mt-3 text-xs font-bold app-muted-text">
                      整门课程 {heroCourseProgress.percent}% · 已完成{" "}
                      {heroCourseProgress.completedCount} / {heroCourseProgress.totalCount} 课时
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {heroHref && (
                  <Link
                    href={heroHref}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black motion-safe:transition motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
                    style={{
                      color: "var(--app-accent-contrast)",
                      backgroundColor: "var(--app-accent-strong)",
                    }}
                  >
                    <PlayCircle size={17} aria-hidden="true" />
                    {hero.status === "completed" ? "复习最近课时" : "继续上次学习"}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
                <Link
                  href={coursesHref}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold motion-safe:transition hover:bg-[var(--app-soft-bg)] ${FOCUS_RING}`}
                  style={{ borderColor: "var(--app-border)" }}
                >
                  查看课程目录
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="mt-7 flex flex-col items-start rounded-[18px] border border-dashed p-5 sm:p-6"
              style={{ borderColor: "var(--app-border)" }}
            >
              <BookOpen size={25} style={{ color: "var(--app-accent)" }} aria-hidden="true" />
              <h3 className="mt-3 text-base font-black">从第一门课程开始</h3>
              <p className="mt-1 text-sm leading-6 app-muted-text">
                选择课程后，这里会显示你下一步最适合继续的课时。
              </p>
              <Link
                href={coursesHref}
                className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-black ${FOCUS_RING}`}
                style={{
                  color: "var(--app-accent-contrast)",
                  backgroundColor: "var(--app-accent-strong)",
                }}
              >
                选择第一门课程
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          )}
        </Surface>

        <Surface tone="quiet" className="flex flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight sm:text-xl">需要你关注</h2>
              <p className="mt-1 text-sm leading-6 app-muted-text">答疑回复与必读资料</p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-black"
              style={{
                color: "var(--app-accent-strong)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              {reminders.length} 项
            </span>
          </div>
          {reminders.length > 0 ? (
            <div className="mt-5 divide-y app-divider">
              {reminders.map((item) => {
                const Icon = item.kind === "teacher_reply" ? BellRing : TriangleAlert;
                const content = (
                  <span className="flex min-h-14 items-start gap-3 rounded-xl px-2 py-3 text-left motion-safe:transition hover:bg-[var(--app-soft-bg)]">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        color:
                          item.kind === "teacher_reply"
                            ? "var(--app-accent-strong)"
                            : "var(--app-warm)",
                        backgroundColor:
                          item.kind === "teacher_reply"
                            ? "var(--app-accent-soft)"
                            : "var(--app-warm-soft)",
                      }}
                    >
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-2 text-sm font-black leading-5">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 app-muted-text">
                        {item.subtitle}
                      </span>
                    </span>
                    <ArrowRight size={15} className="mt-3 shrink-0 app-muted-text" aria-hidden="true" />
                  </span>
                );

                if (!item.href) return <div key={item.id}>{content}</div>;
                const reminderHref = scopeDashboardPath(item.href, dashboardBasePath);
                return item.kind === "teacher_reply" ? (
                  <form key={item.id} action={reminderHref} method="post">
                    <button type="submit" className={`block w-full cursor-pointer rounded-xl ${FOCUS_RING}`}>
                      {content}
                    </button>
                  </form>
                ) : (
                  <Link key={item.id} href={reminderHref} className={`block rounded-xl ${FOCUS_RING}`}>
                    {content}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-9 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  color: "var(--app-success)",
                  backgroundColor: "var(--app-success-soft)",
                }}
              >
                <CheckCircle2 size={23} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-black">今天没有待处理事项</h3>
              <p className="mt-1 text-sm leading-6 app-muted-text">可以专心完成当前课程</p>
            </div>
          )}
        </Surface>
      </div>

      <Surface className="mt-5 overflow-hidden">
        <h2 className="sr-only">学习数据概览</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`p-4 sm:p-5 ${index % 2 ? "border-l" : ""} ${index >= 2 ? "border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}
                style={{ borderColor: "var(--app-border-soft)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: stat.color, backgroundColor: stat.soft }}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold app-muted-text">{stat.label}</p>
                    <p className="mt-0.5 text-xl font-black tabular-nums sm:text-2xl">
                      {stat.value}
                      <span className="ml-1 text-xs font-bold app-muted-text">{stat.suffix}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Surface>

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.7fr)]">
        <Surface className="p-5 sm:p-6">
          <SectionHeading
            icon={LineChart}
            title="近 7 天学习节奏"
            description="按数据库中的有效学习时间统计，不把页面停留当作学习成果。"
            action={
              <div className="flex items-center gap-2">
                <MonthlyStudyDialog
                  monthLabel={monthStudy.label}
                  buttonLabel="月度"
                  dailyMinutes={monthStudy.values}
                  dayTips={monthStudy.tips}
                  totalMinutes={monthStudy.totalMinutes}
                  maxMinutes={monthStudy.maxMinutes}
                />
                <MonthlyStudyDialog
                  monthLabel={yearStudy.label}
                  buttonLabel="年度"
                  dailyMinutes={yearStudy.values}
                  dayTips={yearStudy.tips}
                  totalMinutes={yearStudy.totalMinutes}
                  maxMinutes={yearStudy.maxMinutes}
                  xLabelUnit={yearStudy.xLabelUnit}
                />
              </div>
            }
          />

          <div
            className="growth-panel growth-panel--chart mt-6 grid min-h-56 grid-cols-7 items-end gap-2 rounded-[18px] px-3 pb-4 pt-6 sm:gap-4 sm:px-6"
            role="img"
            aria-label={`近7天有效学习 ${formatMinutes(recentSevenDayStudyMinutes)}，活跃 ${recentSevenDayActiveDays} 天`}
          >
            {weekActivityDays.map((day) => {
              const height = hasWeeklyActivity
                ? day.minutes === 0
                  ? 6
                  : Math.max(18, (day.minutes / maxWeeklyMinutes) * 100)
                : 6;
              return (
                <div key={day.dateString} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-black tabular-nums app-muted-text">
                    {day.minutes > 0 ? `${day.minutes}` : "–"}
                    <span className="sr-only">分钟</span>
                  </span>
                  <div className="flex h-32 w-full max-w-12 items-end" title={`${getShortDate(day.dateString)} · 有效学习 ${formatMinutes(day.minutes)} · 完成 ${day.completedCount} 个课时`}>
                    <div
                      className="w-full rounded-t-lg"
                      style={{
                        height: `${height}%`,
                        backgroundColor:
                          day.minutes > 0 ? "var(--app-accent)" : "var(--app-border)",
                        opacity: day.minutes > 0 ? 1 : 0.7,
                      }}
                    />
                  </div>
                  <time dateTime={day.dateString} className="text-xs font-bold app-muted-text">
                    {getWeekday(day.dateString)}
                  </time>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold app-muted-text">
            <span>数字单位：分钟</span>
            <span>近 7 天完成 {weekActivityDays.reduce((sum, day) => sum + day.completedCount, 0)} 个课时</span>
          </div>
        </Surface>

        <Surface tone="quiet" className="flex flex-col p-5 sm:p-6">
          <SectionHeading
            icon={Activity}
            title="成长洞察"
            description="根据最近 7 天真实学习记录生成"
          />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="growth-panel growth-panel--accent rounded-2xl p-4">
              <p className="text-xs font-bold app-muted-text">有效学习</p>
              <p className="mt-1 text-xl font-black tabular-nums">{formatMinutes(recentSevenDayStudyMinutes)}</p>
            </div>
            <div className="growth-panel growth-panel--warm rounded-2xl p-4">
              <p className="text-xs font-bold app-muted-text">活跃天数</p>
              <p className="mt-1 text-xl font-black tabular-nums">{recentSevenDayActiveDays}<span className="ml-1 text-xs">天</span></p>
            </div>
          </div>
          <div className="growth-panel growth-panel--raised mt-4 flex-1 rounded-2xl p-4">
            <p className="text-sm font-black">本周建议</p>
            <p className="mt-2 text-sm leading-7 app-muted-text">
              {recentSevenDayStudyMinutes === 0
                ? "还没有有效学习时长。先完成一次短学习，成长趋势会从真实记录开始生成。"
                : recentSevenDayActiveDays >= 5
                  ? "学习节奏很稳定。下一步优先完成正在进行的课时，避免同时开启过多内容。"
                  : `最近已有 ${recentSevenDayActiveDays} 天有效学习。可以把学习安排得更均匀，保持连续性比单日突击更重要。`}
            </p>
            {bestStudyDay && bestStudyDay.minutes > 0 && (
              <p className="mt-3 text-xs font-bold" style={{ color: "var(--app-accent-strong)" }}>
                最投入：{getShortDate(bestStudyDay.dateString)} · {formatMinutes(bestStudyDay.minutes)}
              </p>
            )}
          </div>
          <Link
            href={recordsHref}
            className={`mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black motion-safe:transition hover:bg-[var(--app-soft-bg)] ${FOCUS_RING}`}
            style={{ borderColor: "var(--app-border)" }}
          >
            查看完整学习分析
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </Surface>
      </div>

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.7fr)]">
        <Surface className="p-5 sm:p-6">
          <SectionHeading
            icon={GraduationCap}
            title="课程进展"
            description="优先展示最近学习过的课程"
            action={
              <Link
                href={coursesHref}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-black app-muted-text motion-safe:transition hover:bg-[var(--app-soft-bg)] ${FOCUS_RING}`}
              >
                全部课程
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            }
          />
          {visibleCourses.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visibleCourses.map((course) => (
                <Link
                  key={course.courseId}
                  href={scopeDashboardPath(course.href, dashboardBasePath)}
                  className={`growth-course-card group rounded-[18px] border p-4 motion-safe:transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-sm ${FOCUS_RING}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
                    >
                      <BookOpen size={18} aria-hidden="true" />
                    </span>
                    <ArrowRight size={15} className="app-muted-text motion-safe:transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 line-clamp-2 text-base font-black leading-6">{course.title}</h3>
                  <p className="mt-1 min-h-5 text-xs app-muted-text">
                    {course.teacherName ? `${course.teacherName} 老师` : "自主学习课程"}
                  </p>
                  <div className="mt-5">
                    <ProgressBar value={course.percent} label={`已完成 ${course.completedCount} / ${course.totalCount} 课时`} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--app-border)" }}>
              <p className="text-sm font-black">还没有课程进度</p>
              <p className="mt-1 text-sm app-muted-text">进入课程学习后，这里会显示整体进展。</p>
            </div>
          )}
        </Surface>

        <Surface tone="accent" className="flex flex-col p-5 sm:p-6">
          <SectionHeading
            icon={BookText}
            title="成长工具箱"
            description="用短练习保持学习手感"
          />
          <Link
            href={vocabularyHref}
            className={`growth-panel growth-panel--accent-strong group mt-6 flex flex-1 flex-col justify-between rounded-[18px] p-5 motion-safe:transition motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-card-bg)" }}
              >
                <BookText size={21} aria-hidden="true" />
              </span>
              <ArrowRight size={17} className="motion-safe:transition group-hover:translate-x-1" aria-hidden="true" />
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-black">单词练习</h3>
              <p className="mt-2 text-sm leading-6 app-muted-text">
                {vocabularyThisWeekMinutes > 0
                  ? `本周已练习 ${vocabularyThisWeekMinutes} 分钟，继续保持。`
                  : "开始一次短练习，巩固本周词汇。"}
              </p>
            </div>
          </Link>
          <Link
            href={toolboxHref}
            className={`mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black motion-safe:transition hover:bg-[var(--app-soft-bg)] ${FOCUS_RING}`}
            style={{ borderColor: "var(--app-border)" }}
          >
            查看全部工具
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Surface>
      </div>

      {recentActivity.length > 0 && (
        <Surface className="mt-5 p-5 sm:p-6">
          <SectionHeading
            icon={BarChart3}
            title="最近学习"
            description="按最近访问时间排列的学习轨迹"
            action={
              <Link
                href={recordsHref}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-black app-muted-text motion-safe:transition hover:bg-[var(--app-soft-bg)] ${FOCUS_RING}`}
              >
                查看全部
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            }
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {recentActivity.slice(0, 4).map((item) => {
              const content = (
                <span className="growth-record-row flex min-h-20 items-center gap-3 rounded-[18px] border p-4 motion-safe:transition">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      color: item.status === "completed" ? "var(--app-success)" : "var(--app-accent-strong)",
                      backgroundColor: item.status === "completed" ? "var(--app-success-soft)" : "var(--app-accent-soft)",
                    }}
                  >
                    {item.status === "completed" ? (
                      <CheckCircle2 size={18} aria-hidden="true" />
                    ) : (
                      <PlayCircle size={18} aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{item.lessonTitle}</span>
                    <span className="mt-1 block truncate text-xs app-muted-text">{item.courseTitle}</span>
                    <span className="mt-1 block text-xs app-muted-text">
                      <LocalDateTime value={item.lastViewedAt} options={DATE_TIME_OPTIONS} />
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: "var(--app-accent-strong)" }}>
                    {Math.min(100, Math.max(0, item.progressPercent))}%
                  </span>
                </span>
              );

              return item.href ? (
                <Link
                  key={item.lessonId}
                  href={scopeDashboardPath(item.href, dashboardBasePath)}
                  className={`rounded-[18px] ${FOCUS_RING}`}
                >
                  {content}
                </Link>
              ) : (
                <div key={item.lessonId}>{content}</div>
              );
            })}
          </div>
        </Surface>
      )}
    </div>
  );
}
