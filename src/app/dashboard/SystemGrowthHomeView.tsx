import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  BookText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Play,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import type {
  GrowthActivityItem,
  GrowthCourseProgressItem,
  GrowthReminderItem,
  GrowthWeekActivityDay,
} from "./GrowthHomeView";
import { MonthlyStudyDialog } from "./MonthlyStudyDialog";

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
  in_progress: "学习中",
  completed: "已完成",
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
        <span className="student-system-muted">{label}</span>
        <span className="tabular-nums">{safeValue}%</span>
      </div>
      <div
        className="student-system-progress mt-2"
        role="progressbar"
        aria-label={`${label} ${safeValue}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function SystemGrowthHomeView({
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
  const maxWeeklyMinutes = Math.max(1, ...weekActivityDays.map((day) => day.minutes));
  const visibleCourses = courseProgressList
    .filter(
      (course): course is GrowthCourseProgressItem & { href: string } =>
        Boolean(course.href)
    )
    .slice(0, 3);
  const primaryReminder = reminders[0] ?? null;
  const bestStudyDay = [...weekActivityDays].sort((a, b) => b.minutes - a.minutes)[0];
  const weeklyGoalPercent = Math.min(100, Math.round((recentSevenDayActiveDays / 5) * 100));

  const metrics = [
    {
      label: "今日有效学习",
      value: formatMinutes(todayStudyMinutes),
      note: todayStudyMinutes > 0 ? "已计入学习档案" : "完成一次学习后开始记录",
      icon: Clock3,
    },
    {
      label: "连续学习",
      value: `${streakDays} 天`,
      note: streakDays > 0 ? "保持稳定节奏" : "今天可以开始连续记录",
      icon: Flame,
    },
    {
      label: "正在学习",
      value: `${inProgressLessonsCount} 个课时`,
      note: `累计完成 ${completedLessonsCount} 个课时`,
      icon: BookOpen,
    },
    {
      label: "本周目标",
      value: `${weeklyGoalPercent}%`,
      note: `本周完成 ${thisWeekCompletedCount} 个课时`,
      icon: Target,
    },
  ];

  const reminderContent = primaryReminder ? (
    <span className="student-system-alert-content">
      <span className="student-system-alert-icon">
        {primaryReminder.kind === "teacher_reply" ? (
          <BellRing size={18} aria-hidden="true" />
        ) : (
          <TriangleAlert size={18} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{primaryReminder.title}</strong>
        <span className="student-system-muted mt-0.5 block truncate text-sm">
          {primaryReminder.subtitle}
          {reminders.length > 1 ? `，另有 ${reminders.length - 1} 项需要关注` : ""}
        </span>
      </span>
      <span className="student-system-alert-action">
        查看详情
        <ArrowRight size={14} aria-hidden="true" />
      </span>
    </span>
  ) : null;

  return (
    <div className="software-growth-home px-4 pb-10 pt-4 sm:px-6 sm:pt-5 xl:px-7">
      <h1 className="sr-only">成长首页</h1>

      {primaryReminder && reminderContent ? (
        primaryReminder.href ? (
          primaryReminder.kind === "teacher_reply" ? (
            <form
              action={scopeDashboardPath(primaryReminder.href, dashboardBasePath)}
              method="post"
              className="student-system-alert"
            >
              <button type="submit" className="block w-full text-left">
                {reminderContent}
              </button>
            </form>
          ) : (
            <Link
              href={scopeDashboardPath(primaryReminder.href, dashboardBasePath)}
              className="student-system-alert block"
            >
              {reminderContent}
            </Link>
          )
        ) : (
          <div className="student-system-alert">{reminderContent}</div>
        )
      ) : (
        <section className="student-system-welcome" aria-labelledby="growth-welcome-title">
          <div className="student-system-welcome-main">
            <span className="student-system-welcome-icon" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0">
              <span className="student-system-welcome-eyebrow">今日学习</span>
              <h2 id="growth-welcome-title">{greeting}，{studentName}</h2>
              <p>今天没有待处理事项，可以专心完成当前课程。</p>
            </div>
          </div>

          <div className="student-system-welcome-summary">
            <span className="student-system-welcome-status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>
                <small>待处理事项</small>
                <strong>全部完成</strong>
              </span>
            </span>
            <span className="student-system-welcome-streak">
              <Flame size={14} aria-hidden="true" />
              {streakDays > 0 ? `连续学习 ${streakDays} 天` : "今天开始积累"}
            </span>
          </div>
        </section>
      )}

      <section className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-labelledby="growth-metrics-title">
        <h2 id="growth-metrics-title" className="sr-only">学习数据概览</h2>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="student-system-metric">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="student-system-muted text-xs font-semibold">{metric.label}</p>
                  <p className="mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{metric.value}</p>
                </div>
                <span className="student-system-metric-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
              </div>
              <p className="student-system-muted mt-3 truncate text-[11px]">{metric.note}</p>
            </article>
          );
        })}
      </section>

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-12">
        <section className="student-system-card flex flex-col xl:col-span-5" aria-labelledby="continue-learning-title">
          <header className="student-system-card-header">
            <div>
              <h2 id="continue-learning-title">继续学习</h2>
              <p>从上次停下的位置继续</p>
            </div>
            <Link href={coursesHref} className="student-system-text-action">
              全部课程 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>

          {hero ? (
            <div className="student-system-current-course">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="student-system-course-badge">{hero.courseTitle}</span>
                <span className="student-system-muted">{STATUS_LABELS[hero.status] ?? hero.status}</span>
              </div>
              <h3>{hero.lessonTitle}</h3>
              <div className="mt-5">
                <SystemProgress value={heroLessonProgress} label="当前课时" />
              </div>
              {heroCourseProgress && (
                <p className="student-system-muted mt-3 text-xs">
                  整门课程 {heroCourseProgress.percent}% · 已完成 {heroCourseProgress.completedCount}/{heroCourseProgress.totalCount} 个课时
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {heroHref && (
                  <Link href={heroHref} className="student-system-primary-button">
                    <Play size={14} fill="currentColor" aria-hidden="true" />
                    {hero.status === "completed" ? "重新学习" : "继续学习"}
                  </Link>
                )}
                <Link href={coursesHref} className="student-system-secondary-button">
                  课程目录
                </Link>
              </div>
            </div>
          ) : (
            <div className="student-system-empty flex-1">
              <BookOpen size={22} aria-hidden="true" />
              <h3>从第一门课程开始</h3>
              <p>选择课程后，这里会显示下一步最适合学习的内容。</p>
              <Link href={coursesHref} className="student-system-primary-button mt-4">
                选择课程
              </Link>
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="student-system-recent-list">
              {recentActivity.slice(0, 3).map((item) => {
                const row = (
                  <span className="student-system-recent-row">
                    <span className="student-system-recent-state" data-status={item.status} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{item.lessonTitle}</strong>
                      <span className="student-system-muted mt-0.5 block truncate text-xs">{item.courseTitle}</span>
                    </span>
                    <span className="student-system-muted shrink-0 text-[10px]">
                      <LocalDateTime value={item.lastViewedAt} options={DATE_OPTIONS} />
                    </span>
                  </span>
                );

                return item.href ? (
                  <Link key={item.lessonId} href={scopeDashboardPath(item.href, dashboardBasePath)}>
                    {row}
                  </Link>
                ) : (
                  <div key={item.lessonId}>{row}</div>
                );
              })}
            </div>
          )}
        </section>

        <section className="student-system-card xl:col-span-7" aria-labelledby="study-trend-title">
          <header className="student-system-card-header">
            <div>
              <h2 id="study-trend-title">学习趋势与分析</h2>
              <p>最近 7 天有效学习时间</p>
            </div>
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
          </header>

          <div
            className="student-system-week-chart"
            role="img"
            aria-label={`最近 7 天有效学习 ${formatMinutes(recentSevenDayStudyMinutes)}，活跃 ${recentSevenDayActiveDays} 天`}
          >
            {weekActivityDays.map((day) => {
              const height = day.minutes > 0
                ? Math.max(14, (day.minutes / maxWeeklyMinutes) * 100)
                : 5;
              return (
                <div key={day.dateString} className="student-system-chart-column">
                  <span className="tabular-nums">{day.minutes || "–"}</span>
                  <div title={`${formatShortDate(day.dateString)} · ${formatMinutes(day.minutes)} · 完成 ${day.completedCount} 个课时`}>
                    <span style={{ height: `${height}%` }} data-empty={day.minutes === 0 ? "true" : "false"} />
                  </div>
                  <time dateTime={day.dateString}>{formatWeekday(day.dateString)}</time>
                </div>
              );
            })}
          </div>

          <div className="student-system-insight-grid">
            <div>
              <span>有效学习</span>
              <strong>{formatMinutes(recentSevenDayStudyMinutes)}</strong>
            </div>
            <div>
              <span>活跃天数</span>
              <strong>{recentSevenDayActiveDays} 天</strong>
            </div>
            <div>
              <span>最投入日期</span>
              <strong>{bestStudyDay?.minutes ? formatShortDate(bestStudyDay.dateString) : "等待记录"}</strong>
            </div>
          </div>

          <div className="student-system-analysis-note">
            <span className="student-system-analysis-icon"><CalendarDays size={17} aria-hidden="true" /></span>
            <div>
              <strong>本周学习分析</strong>
              <p>
                {recentSevenDayStudyMinutes === 0
                  ? "还没有有效学习记录。完成一次短学习后，系统会从真实数据开始分析。"
                  : recentSevenDayActiveDays >= 5
                    ? "学习节奏稳定。建议优先完成正在进行的章节，保持当前连续性。"
                    : `最近已有 ${recentSevenDayActiveDays} 天有效学习。把学习分散到更多天，比单日集中更容易保持。`}
              </p>
            </div>
            <Link href={recordsHref} className="student-system-text-action shrink-0">
              完整分析 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-12">
        <section className="student-system-card xl:col-span-8" aria-labelledby="course-progress-title">
          <header className="student-system-card-header">
            <div>
              <h2 id="course-progress-title">课程进度</h2>
              <p>最近学习的课程</p>
            </div>
            <Link href={coursesHref} className="student-system-text-action">
              查看全部 <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>

          {visibleCourses.length > 0 ? (
            <div className="student-system-course-grid">
              {visibleCourses.map((course) => (
                <Link
                  key={course.courseId}
                  href={scopeDashboardPath(course.href, dashboardBasePath)}
                  className="student-system-course-card"
                >
                  <span className="student-system-course-icon"><BookOpen size={17} aria-hidden="true" /></span>
                  <h3>{course.title}</h3>
                  <p>{course.teacherName ? `${course.teacherName} 老师` : "自主学习课程"}</p>
                  <SystemProgress value={course.percent} label={`${course.completedCount}/${course.totalCount} 课时`} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="student-system-empty">
              <BookOpen size={22} aria-hidden="true" />
              <h3>还没有课程进度</h3>
              <p>进入课程学习后，这里会形成你的课程地图。</p>
            </div>
          )}
        </section>

        <section className="student-system-card xl:col-span-4" aria-labelledby="growth-tools-title">
          <header className="student-system-card-header">
            <div>
              <h2 id="growth-tools-title">今日练习</h2>
              <p>用短练习巩固学习成果</p>
            </div>
          </header>
          <Link href={vocabularyHref} className="student-system-practice-card">
            <span><BookText size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <strong>单词练习</strong>
              <p>
                {vocabularyThisWeekMinutes > 0
                  ? `本周已练习 ${vocabularyThisWeekMinutes} 分钟`
                  : "开始一次短练习，巩固本周词汇"}
              </p>
            </div>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href={toolboxHref} className="student-system-secondary-button mt-3 w-full">
            查看全部学习工具
          </Link>
        </section>
      </div>
    </div>
  );
}
