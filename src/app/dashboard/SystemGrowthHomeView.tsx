import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  BookText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Headphones,
  Mic,
  Shapes,
  Timer,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { DashboardTitleWithHint } from "./DashboardTitleWithHint";
import {
  ContinueLastLearningCard,
  DailyLearningLoadFailedCard,
  LearningEntryNav,
  RequiredTodayCard,
  TodaySuggestionsCard,
} from "./DailyLearningWorkspace";
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
  courseContinuationTask: HomeLearningTask | null;
  reminders: GrowthReminderItem[];
  recentActivity: GrowthActivityItem[];
  courseProgressList: GrowthCourseProgressItem[];
  weekActivityDays: GrowthWeekActivityDay[];
  inProgressLessonsCount: number;
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
  weeklyPlanTasks: HomeLearningTask[];
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

const SEOUL_DATE_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SEOUL_TIME = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const STUDY_TIME_SLOTS = Array.from({ length: 15 }, (_, index) => {
  const hour = index + 9;
  const hourLabel = String(hour).padStart(2, "0");
  return {
    hour,
    label: `${hourLabel}:00～${hourLabel}:50`,
  };
}).filter(({ hour }) => hour !== 12 && hour !== 18);

const TASK_SOURCE_LABELS: Record<HomeLearningTask["sourceType"], string> = {
  assignment: "作业",
  exam: "考试",
  course: "课程",
  chapter_practice: "章节巩固",
  specialized_practice: "专项训练",
  review: "错题复习",
  teacher_recommendation: "老师推荐",
  student_plan: "学习计划",
};

const TASK_STATUS_LABELS: Record<HomeLearningTask["status"], string> = {
  not_started: "未开始",
  available: "可开始",
  in_progress: "进行中",
  submitted: "已提交",
  pending_grading: "待批改",
  completed: "已完成",
  overdue: "已逾期",
  locked: "未开放",
  unavailable: "暂不可用",
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

function toSeoulDateKey(value: string | Date) {
  return SEOUL_DATE_KEY.format(typeof value === "string" ? new Date(value) : value);
}

function buildCurrentWeek(nowISOString: string) {
  const todayKey = toSeoulDateKey(nowISOString);
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  const weekday = new Date(todayUtc).getUTCDay();
  const mondayUtc = todayUtc - (weekday === 0 ? 6 : weekday - 1) * 86_400_000;

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(mondayUtc + index * 86_400_000);
    return {
      dateString: date.toISOString().slice(0, 10),
      dayNumber: date.getUTCDate(),
      weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "UTC" }).format(date),
    };
  });
}

function taskDateKey(task: HomeLearningTask) {
  const value = task.dueAt ?? task.startsAt;
  return value ? toSeoulDateKey(value) : null;
}

function taskTimeLabel(task: HomeLearningTask, fallbackToday: boolean) {
  if (task.dueAt) return `截止 ${SEOUL_TIME.format(new Date(task.dueAt))}`;
  if (task.startsAt) return `开始 ${SEOUL_TIME.format(new Date(task.startsAt))}`;
  return fallbackToday ? "今日重点" : null;
}

function taskScheduleHour(task: HomeLearningTask) {
  const value = task.dueAt ?? task.startsAt;
  if (!value) return 9;
  const hour = Number(SEOUL_TIME.format(new Date(value)).slice(0, 2));
  const boundedHour = Math.max(
    9,
    Math.min(23, Number.isFinite(hour) ? hour : 9),
  );
  if (boundedHour === 12 || boundedHour === 18) return boundedHour + 1;
  return boundedHour;
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
        <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function WeeklyLearningPlan({
  tasks,
  activityDays,
  nowISOString,
}: {
  tasks: HomeLearningTask[];
  activityDays: GrowthWeekActivityDay[];
  nowISOString: string;
}) {
  const days = buildCurrentWeek(nowISOString);
  const todayKey = toSeoulDateKey(nowISOString);
  const activityByDate = new Map(activityDays.map((day) => [day.dateString, day]));
  const rangeLabel = `${days[0].dateString.slice(5).replace("-", "/")}–${days[6].dateString.slice(5).replace("-", "/")}`;

  return (
    <section className="korean-week-plan" aria-labelledby="weekly-plan-title">
      <header className="korean-section-heading">
        <div>
          <h2 id="weekly-plan-title">本周学习计划</h2>
          <p>课程、作业和练习均来自当前真实学习任务</p>
        </div>
        <span className="korean-week-range">
          <CalendarDays size={15} aria-hidden="true" />
          {rangeLabel}
        </span>
      </header>

      <div
        className="korean-week-grid"
        role="region"
        aria-label="本周七日分时学习安排，可横向滚动"
        tabIndex={0}
      >
        <div className="korean-week-table">
          <div className="korean-week-corner" aria-hidden="true">时间</div>
          {days.map((day) => {
            const activity = activityByDate.get(day.dateString);
            return (
              <div
                key={`header-${day.dateString}`}
                className="korean-week-day-header"
                data-today={day.dateString === todayKey ? "true" : undefined}
                aria-label={`${day.dayNumber}日 ${day.weekday}${day.dateString === todayKey ? "，今天" : ""}${activity?.minutes ? `，已学习${activity.minutes}分钟` : ""}`}
              >
                <span>{day.dayNumber}</span>
                <strong>{day.weekday}</strong>
                {day.dateString === todayKey && <small>今天</small>}
              </div>
            );
          })}

          {STUDY_TIME_SLOTS.map((slot) => (
            <div key={slot.hour} className="contents">
              <div className="korean-week-time">{slot.label}</div>
              {days.map((day) => {
                const datedTasks = tasks.filter(
                  (task) =>
                    taskDateKey(task) === day.dateString &&
                    taskScheduleHour(task) === slot.hour,
                );
                const visibleTasks = datedTasks.slice(0, 2);
                const hiddenCount = Math.max(
                  0,
                  datedTasks.length - visibleTasks.length,
                );

                return (
                  <div
                    key={`${day.dateString}-${slot.hour}`}
                    className="korean-week-slot"
                    data-today={day.dateString === todayKey ? "true" : undefined}
                  >
                    {visibleTasks.map((task) => (
                      <Link
                        key={task.taskKey}
                        href={task.href}
                        className="korean-schedule-card"
                        data-source={task.sourceType}
                      >
                        <span>{TASK_SOURCE_LABELS[task.sourceType]}</span>
                        <strong>{task.title}</strong>
                        <small>
                          {taskTimeLabel(task, false)} · {TASK_STATUS_LABELS[task.status]}
                        </small>
                      </Link>
                    ))}
                    {hiddenCount > 0 && (
                      <span className="korean-week-more">另有 {hiddenCount} 项</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
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
  courseContinuationTask,
  reminders,
  recentActivity,
  courseProgressList,
  weekActivityDays,
  inProgressLessonsCount,
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
  weeklyPlanTasks,
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
  const weeklyGoalPercent = Math.min(100, Math.round((recentSevenDayActiveDays / 5) * 100));
  const focusHref = courseContinuationTask?.href ?? heroHref ?? coursesHref;
  const focusTitle = courseContinuationTask
    ? courseContinuationTask.title.replace(/^继续学习\s*/, "")
    : hero?.lessonTitle ?? "查看全部韩语课程";
  const focusNote =
    courseContinuationTask?.description ?? hero?.courseTitle ?? null;
  const courseProgress = heroCourseProgress?.percent ?? heroLessonProgress;

  const studyRanges = [
    {
      id: "week" as const,
      label: "近 7 天",
      periodLabel: "最近 7 天",
      values: weekActivityDays.map((day) => day.minutes),
      axisLabels: weekActivityDays.map((day) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date(`${day.dateString}T12:00:00Z`))),
      tips: weekActivityDays.map((day) => `${day.dateString.slice(5).replace("-", "月")}日 · ${formatMinutes(day.minutes)} · 完成 ${day.completedCount} 个课时`),
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
    { label: "背单词", description: vocabularyThisWeekMinutes > 0 ? `本周 ${vocabularyThisWeekMinutes} 分钟` : "核心词语与语境", href: vocabularyHref, icon: BookText, tone: "lilac" },
    { label: "听力练习", description: "从短对话开始", href: `${toolboxHref}/listening`, icon: Headphones, tone: "blue" },
    { label: "口语练习", description: "跟读与情境表达", href: `${toolboxHref}/speaking`, icon: Mic, tone: "sand" },
    { label: "语法课程", description: "句型结构与运用", href: `${toolboxHref}/grammar`, icon: Shapes, tone: "mint" },
    { label: "开始测验", description: "检验学习效果", href: assignmentsHref, icon: CheckCircle2, tone: "rose" },
  ];

  return (
    <div className="software-growth-home korean-dashboard-home px-4 pb-10 pt-4 sm:px-6 xl:px-7">
      <header className="korean-dashboard-hero">
        <div className="korean-dashboard-title">
          <h1>韩语学习</h1>
          <p>{greeting}，{studentName}。每天进步一点，继续完成今天真实可用的学习任务。</p>
        </div>
        <Link href={focusHref} className="korean-focus-card">
          <span>继续学习</span>
          <strong>{focusTitle}</strong>
          {focusNote && <small>{focusNote}</small>}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </header>

      <section className="korean-overview-grid" aria-label="本周学习概览">
        <article className="korean-progress-card">
          <div className="korean-progress-ring" style={{ "--progress": `${weeklyGoalPercent * 3.6}deg` } as CSSProperties}>
            <span><strong>{recentSevenDayActiveDays}</strong>/5</span>
          </div>
          <div className="min-w-0 flex-1">
            <span>本周学习进度</span>
            <strong>完成 {recentSevenDayActiveDays} 个学习日</strong>
            <span className="sr-only">目标每周学习 5 天，已完成 {recentSevenDayActiveDays} 天</span>
            <div className="korean-progress-segments" aria-label={`每周 5 天目标，已完成 ${recentSevenDayActiveDays} 天`}>
              {Array.from({ length: 5 }, (_, index) => <i key={index} data-complete={index < recentSevenDayActiveDays ? "true" : undefined} />)}
            </div>
            <Link href={recordsHref}>查看详情 <ArrowRight size={13} aria-hidden="true" /></Link>
          </div>
        </article>

        <article className="korean-stat-card korean-stat-card--warm">
          <span><Flame size={17} aria-hidden="true" /></span>
          <small>连续学习</small>
          <strong>{streakDays} 天</strong>
          <p>{streakDays > 0 ? "继续保持当前节奏" : "今天开始积累"}</p>
        </article>

        <article className="korean-stat-card korean-stat-card--blue">
          <span><Clock3 size={17} aria-hidden="true" /></span>
          <small>近 7 天学习</small>
          <strong>{formatMinutes(recentSevenDayStudyMinutes)}</strong>
          <p>今天 {formatMinutes(todayStudyMinutes)}</p>
        </article>

        <article className="korean-stat-card korean-stat-card--mint">
          <span><Timer size={17} aria-hidden="true" /></span>
          <small>总学习时长</small>
          <strong>{formatMinutes(yearStudy.totalMinutes)}</strong>
          <p>{yearStudy.label}累计</p>
        </article>
      </section>

      {dailyLearningLoadFailed ? (
        <div className="korean-dashboard-message">
          <DailyLearningLoadFailedCard reloadHref={dashboardBasePath} coursesHref={coursesHref} />
        </div>
      ) : (
        <WeeklyLearningPlan tasks={weeklyPlanTasks} activityDays={weekActivityDays} nowISOString={dailyLearningNowISOString} />
      )}

      <nav className="korean-quick-start" aria-label="快速开始学习">
        <header>
          <div>
            <h2>快速开始学习</h2>
            <p>选择一个方向，立即进入练习</p>
          </div>
          <Link href={toolboxHref}>查看全部 <ArrowRight size={13} aria-hidden="true" /></Link>
        </header>
        <div>
          {practiceEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link key={entry.label} href={entry.href} className="korean-quick-card" data-tone={entry.tone}>
                <span><Icon size={18} aria-hidden="true" /></span>
                <strong>{entry.label}</strong>
                <small>{entry.description}</small>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </nav>

      <details className="korean-more-overview">
        <summary>
          <span>更多学习概览</span>
          <small>任务、课程进度和学习趋势</small>
        </summary>

        <div className="korean-more-grid">
          <div className="korean-home-panel korean-home-span-7">
            <RequiredTodayCard requiredTodayTasks={requiredTodayTasks} nowISOString={dailyLearningNowISOString} coursesHref={coursesHref} />
          </div>
          <div className="korean-home-panel korean-home-span-5">
            <ContinueLastLearningCard tasks={dailyLearningTasks} coursesHref={coursesHref} />
          </div>
          <div className="korean-home-panel korean-home-span-full">
            <TodaySuggestionsCard tasks={dailyLearningTasks} coursePracticeHref={coursePracticeHref} />
          </div>

          <section className="korean-home-panel korean-home-span-5" aria-labelledby="course-progress-title">
            <header className="korean-section-heading">
              <div>
                <h2 id="course-progress-title">课程进度</h2>
                <p>最近学习课程的真实完成情况</p>
              </div>
              <Link href={coursesHref}>查看全部 <ArrowRight size={13} aria-hidden="true" /></Link>
            </header>
            {visibleCourses.length > 0 ? (
              <div className="korean-course-list">
                {visibleCourses.map((course) => (
                  <article key={course.courseId}>
                    <DashboardTitleWithHint
                      title={course.title}
                      description={course.href ? course.teacherName ? `${course.teacherName} 老师` : "自主学习课程" : "入口待完善，可从课程目录继续查找"}
                      headingLevel={3}
                      titleClassName="text-sm font-bold"
                    />
                    {!course.href && <span>入口待完善</span>}
                    <SystemProgress value={course.percent} label={`${course.completedCount}/${course.totalCount} 课时`} />
                  </article>
                ))}
              </div>
            ) : (
              <p className="korean-empty-copy">进入课程学习后，这里会形成你的课程进度。</p>
            )}
          </section>

          <section className="korean-home-panel korean-home-span-7" aria-labelledby="study-trend-title">
            <StudentStudyTrendPanel ranges={studyRanges} />
            <Link href={recordsHref} className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--primary-hover)]">
              学习记录 <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </section>

          {secondaryRecentActivity.length > 0 && (
            <section className="korean-home-panel korean-home-span-6" aria-labelledby="recent-learning-title">
              <header className="korean-section-heading">
                <div><h2 id="recent-learning-title">最近学习位置</h2><p>继续最近打开的课程内容</p></div>
              </header>
              <div className="korean-recent-list">
                {secondaryRecentActivity.map((item) => (
                  <div key={item.lessonId}>
                    {item.href ? (
                      <Link href={scopeDashboardPath(item.href, dashboardBasePath)}>
                        <BookOpen size={16} aria-hidden="true" />
                        <span><strong>{item.lessonTitle}</strong><small>{item.courseTitle}</small></span>
                        <LocalDateTime value={item.lastViewedAt} options={DATE_OPTIONS} />
                      </Link>
                    ) : (
                      <span><BookOpen size={16} aria-hidden="true" /><strong>{item.lessonTitle}</strong></span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {primaryReminder && (
            <section className="korean-home-panel korean-home-panel--notice korean-home-span-6">
              <header className="korean-section-heading"><div><h2>老师回复</h2><p>你有新的学习反馈</p></div></header>
              {primaryReminder.href ? (
                primaryReminder.kind === "teacher_reply" ? (
                  <form action={scopeDashboardPath(primaryReminder.href, dashboardBasePath)} method="post">
                    <button type="submit" className="korean-reminder-row w-full cursor-pointer text-left">
                      <BellRing size={18} aria-hidden="true" />
                      <span><strong>{primaryReminder.title}</strong><small>{primaryReminder.subtitle}</small></span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <Link href={scopeDashboardPath(primaryReminder.href, dashboardBasePath)} className="korean-reminder-row">
                    <BellRing size={18} aria-hidden="true" />
                    <span><strong>{primaryReminder.title}</strong><small>{primaryReminder.subtitle}</small></span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )
              ) : (
                <div className="korean-reminder-row">
                  <BellRing size={18} aria-hidden="true" />
                  <span><strong>{primaryReminder.title}</strong><small>{primaryReminder.subtitle}</small></span>
                </div>
              )}
            </section>
          )}

          <div className="korean-home-panel korean-home-span-full">
            <LearningEntryNav coursesHref={coursesHref} assignmentsHref={assignmentsHref} coursePracticeHref={coursePracticeHref} specializedPracticeHref={toolboxHref} reviewHref={reviewHref} />
          </div>
        </div>
      </details>

      <span className="sr-only">正在学习 {inProgressLessonsCount} 个课时，当前课程进度 {courseProgress}%</span>
    </div>
  );
}
