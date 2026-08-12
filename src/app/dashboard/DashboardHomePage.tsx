import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  BookText,
  CheckCircle2,
  Ear,
  GraduationCap,
  Mic,
  PlayCircle,
  TriangleAlert,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { MonthlyStudyDialog } from "@/app/dashboard/MonthlyStudyDialog";
import { LocalDateTime } from "@/components/LocalDateTime";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";


type LessonProgressRow = {
  lesson_id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  started_at: string | null;
  last_viewed_at: string | null;
  completed_at: string | null;
};

type LessonRow = {
  id: string;
  slug: string;
  title: string;
  course_id: string;
  is_published: boolean;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  category_id: string | null;
  level: string | null;
  support_teacher_name: string | null;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
};

type ActivityItem = {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  courseTitle: string;
  status: string;
  progressPercent: number;
  lastViewedAt: string;
  href: string | null;
};

type ReminderItem = {
  id: string;
  kind: "teacher_reply" | "required_resource";
  title: string;
  subtitle: string;
  href: string | null;
};

type CourseProgressItem = {
  courseId: string;
  title: string;
  teacherName: string | null;
  completedCount: number;
  totalCount: number;
  percent: number;
  href: string | null;
};

const statusLabelMap: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
};

const MONTHLY_DAY_STUDY_MINUTES_CAP = 8 * 60;
const YEARLY_MONTH_STUDY_MINUTES_CAP = 200 * 60;

function formatStudyMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

const RECENT_ACTIVITY_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

function toSeoulDateString(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function parseDateStringToUTC(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getSeoulHour() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  });

  return Number(formatter.format(new Date()));
}

function getGreeting() {
  const hour = getSeoulHour();

  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getWeekStartISOString() {
  const todayString = toSeoulDateString(new Date());
  const todayUTC = parseDateStringToUTC(todayString);

  const weekday = new Date(todayUTC).getUTCDay();
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;

  const mondayUTC = todayUTC - diffToMonday * 86400000;

  // 韩国标准时间为 UTC+9，周统计按首尔当地周一零点开始。
  return new Date(mondayUTC - 9 * 60 * 60 * 1000).toISOString();
}

function calculateStreak(completedDateStrings: string[]) {
  const daySet = new Set(completedDateStrings);
  const todayString = toSeoulDateString(new Date());

  let cursor = parseDateStringToUTC(todayString);

  if (!daySet.has(todayString)) {
    cursor -= 86400000;
  }

  let streak = 0;

  while (true) {
    const cursorString = new Date(cursor).toISOString().slice(0, 10);

    if (!daySet.has(cursorString)) {
      break;
    }

    streak += 1;
    cursor -= 86400000;
  }

  return streak;
}

export default async function DashboardHomePage() {
  const auth = await requireActiveUser();
  const userRole = auth.profile?.role ?? "student";


  if (userRole !== "student" && userRole !== "platform_course_inspector") {
    redirect(
      scopeDashboardPath(
        "/dashboard/admin",
        getDashboardBasePath(auth.tenant?.slug)
      )
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let studentName = "同学";
  let recentActivity: ActivityItem[] = [];
  let completedLessonsCount = 0;
  let inProgressLessonsCount = 0;
  let streakDays = 0;
  let thisWeekCompletedCount = 0;
  let vocabularyThisWeekSeconds = 0;
  let hero: ActivityItem | null = null;
  let reminders: ReminderItem[] = [];
  const heatmapDays: { dateString: string; count: number }[] = [];
  let monthDailyMinutes: number[] = [];
  let monthDailyTips: string[] = [];
  let monthLabel = "本月";
  let monthTotalMinutes = 0;
  let yearMonthlyMinutes: number[] = [];
  let yearMonthlyTips: string[] = [];
  let yearLabel = "今年";
  let yearTotalMinutes = 0;
  let courseProgressList: CourseProgressItem[] = [];

  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    studentName =
      profileData?.full_name || user.user_metadata?.name || user.email || "同学";

    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select(
        "lesson_id, course_id, status, progress_percent, started_at, last_viewed_at, completed_at"
      )
      .eq("user_id", user.id);

    const progressRows = (progressData ?? []) as LessonProgressRow[];

    completedLessonsCount = progressRows.filter(
      (row) => row.status === "completed"
    ).length;

    inProgressLessonsCount = progressRows.filter(
      (row) => row.status === "in_progress"
    ).length;

    const weekStart = getWeekStartISOString();
    thisWeekCompletedCount = progressRows.filter(
      (row) =>
        row.status === "completed" &&
        row.completed_at &&
        row.completed_at >= weekStart
    ).length;

    const seoulTodayString = toSeoulDateString(new Date());
    const [seoulYear, seoulMonth] = seoulTodayString.split("-").map(Number);
    const learningLogFromISO = new Date(
      Date.UTC(seoulYear, 0, 1) - 9 * 60 * 60 * 1000
    ).toISOString();

    const { data: learningTimeLogData } = await supabase
      .from("learning_time_log")
      .select("seconds, recorded_at, test_slug, source")
      .eq("student_id", user.id)
      .gte("recorded_at", learningLogFromISO);

    const learningTimeLogs = (learningTimeLogData ?? []) as {
      seconds: number;
      recorded_at: string;
      test_slug: string | null;
      source: string | null;
    }[];

    vocabularyThisWeekSeconds = learningTimeLogs
      .filter(
        (row) =>
          row.source === "toolbox" &&
          row.test_slug === "toolbox-vocabulary" &&
          row.recorded_at >= weekStart
      )
      .reduce((sum, row) => sum + Number(row.seconds), 0);

    const buildMinutesByDate = (
      logs: { seconds: number; recorded_at: string }[],
      cap: number
    ) => {
      const map = new Map<string, number>();
      for (const log of logs) {
        const dateString = toSeoulDateString(new Date(log.recorded_at));
        const accumulated =
          (map.get(dateString) ?? 0) + Number(log.seconds) / 60;
        map.set(dateString, Math.min(accumulated, cap));
      }
      return map;
    };

    const daysInMonth = new Date(
      Date.UTC(seoulYear, seoulMonth, 0)
    ).getUTCDate();
    const monthPrefix = `${seoulYear}-${String(seoulMonth).padStart(2, "0")}`;
    const monthMinutesByDay = new Map<number, number>();

    if (learningTimeLogs.length > 0) {
      for (const [dateString, minutes] of buildMinutesByDate(
        learningTimeLogs,
        MONTHLY_DAY_STUDY_MINUTES_CAP
      )) {
        if (!dateString.startsWith(monthPrefix)) continue;
        monthMinutesByDay.set(Number(dateString.slice(8, 10)), minutes);
      }
    } else {
      for (const row of progressRows) {
        if (!row.started_at || !row.last_viewed_at) continue;
        const startTime = new Date(row.started_at).getTime();
        const endTime = new Date(row.last_viewed_at).getTime();
        if (!(endTime > startTime)) continue;
        const sessionMinutes = Math.min(
          (endTime - startTime) / 60000,
          MONTHLY_DAY_STUDY_MINUTES_CAP
        );
        const dateString = toSeoulDateString(new Date(endTime));
        if (!dateString.startsWith(monthPrefix)) continue;
        const day = Number(dateString.slice(8, 10));
        const accumulated = (monthMinutesByDay.get(day) ?? 0) + sessionMinutes;
        monthMinutesByDay.set(
          day,
          Math.min(accumulated, MONTHLY_DAY_STUDY_MINUTES_CAP)
        );
      }
    }

    monthDailyMinutes = Array.from(
      { length: daysInMonth },
      (_, index) => monthMinutesByDay.get(index + 1) ?? 0
    );
    monthTotalMinutes = monthDailyMinutes.reduce((sum, minutes) => sum + minutes, 0);
    monthLabel = `${seoulMonth}月`;
    monthDailyTips = monthDailyMinutes.map(
      (minutes, index) =>
        `${index + 1} 日 · 学习 ${formatStudyMinutes(minutes)}`
    );

    const yearMinutesByMonth = new Map<number, number>();
    for (const [dateString, minutes] of buildMinutesByDate(
      learningTimeLogs,
      YEARLY_MONTH_STUDY_MINUTES_CAP
    )) {
      const [logYear, logMonth] = dateString.split("-").map(Number);
      if (logYear !== seoulYear) continue;
      const accumulated = (yearMinutesByMonth.get(logMonth) ?? 0) + minutes;
      yearMinutesByMonth.set(
        logMonth,
        Math.min(accumulated, YEARLY_MONTH_STUDY_MINUTES_CAP)
      );
    }
    yearMonthlyMinutes = Array.from(
      { length: 12 },
      (_, index) => yearMinutesByMonth.get(index + 1) ?? 0
    );
    yearTotalMinutes = yearMonthlyMinutes.reduce(
      (sum, minutes) => sum + minutes,
      0
    );
    yearLabel = `${seoulYear}年`;
    yearMonthlyTips = yearMonthlyMinutes.map(
      (minutes, index) =>
        `${index + 1} 月 · 学习 ${formatStudyMinutes(minutes)}`
    );

    const completedDateStrings = progressRows
      .filter((row) => row.status === "completed" && row.completed_at)
      .map((row) => toSeoulDateString(new Date(row.completed_at as string)));

    streakDays = calculateStreak(completedDateStrings);

    const countByDate = new Map<string, number>();
    for (const dateString of completedDateStrings) {
      countByDate.set(dateString, (countByDate.get(dateString) ?? 0) + 1);
    }

    const todayUTC = parseDateStringToUTC(toSeoulDateString(new Date()));
    for (let i = 6; i >= 0; i--) {
      const dateString = new Date(todayUTC - i * 86400000)
        .toISOString()
        .slice(0, 10);
      heatmapDays.push({
        dateString,
        count: countByDate.get(dateString) ?? 0,
      });
    }

    const sortedByRecent = [...progressRows]
      .filter((row) => row.last_viewed_at)
      .sort((a, b) =>
        (b.last_viewed_at as string).localeCompare(a.last_viewed_at as string)
      );

    const inProgressLessonIds = progressRows
      .filter((row) => row.status === "in_progress")
      .map((row) => row.lesson_id);

    const recentRows = sortedByRecent.slice(0, 5);

    const touchedCourseIdsInOrder = [
      ...new Set(sortedByRecent.map((row) => row.course_id)),
    ];

    const lessonIdsNeeded = [
      ...new Set([
        ...recentRows.map((row) => row.lesson_id),
        ...inProgressLessonIds,
      ]),
    ];

    const { data: lessonsData } =
      lessonIdsNeeded.length > 0
        ? await supabase
            .from("lessons")
            .select("id, slug, title, course_id, is_published")
            .in("id", lessonIdsNeeded)
        : { data: [] as LessonRow[] };

    const lessons = (lessonsData ?? []) as LessonRow[];
    const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));

    const { data: allCoursesData } = await supabase
      .from("courses")
      .select("id, slug, title, category_id, level, support_teacher_name")
      .eq("is_published", true);

    const { data: allSubcategoriesData } = await supabase
      .from("course_categories")
      .select("id, parent_id, slug")
      .not("parent_id", "is", null)
      .eq("is_published", true);

    const { data: allParentCategoriesData } = await supabase
      .from("course_categories")
      .select("id, parent_id, slug")
      .is("parent_id", null)
      .eq("is_published", true);

    const allCourses = (allCoursesData ?? []) as CourseRow[];

    const subcategories = (allSubcategoriesData ?? []) as CategoryRow[];
    const parentCategories = (allParentCategoriesData ?? []) as CategoryRow[];

    const courseMap = new Map(allCourses.map((course) => [course.id, course]));
    const subcategoryMap = new Map(subcategories.map((sub) => [sub.id, sub]));
    const parentCategoryMap = new Map(
      parentCategories.map((parent) => [parent.id, parent])
    );

    function buildLessonHref(courseId: string, lessonSlug: string): string | null {
      const course = courseMap.get(courseId);
      if (!course || !course.category_id) return null;

      const subcategory = subcategoryMap.get(course.category_id);
      if (!subcategory || !subcategory.parent_id) return null;

      const parentCategory = parentCategoryMap.get(subcategory.parent_id);
      if (!parentCategory) return null;

      return `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lessonSlug}`;
    }

    function buildCourseHref(courseId: string): string | null {
      const course = courseMap.get(courseId);
      if (!course || !course.category_id) return null;

      const subcategory = subcategoryMap.get(course.category_id);
      if (!subcategory || !subcategory.parent_id) return null;

      const parentCategory = parentCategoryMap.get(subcategory.parent_id);
      if (!parentCategory) return null;

      return `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`;
    }

    recentActivity = recentRows
      .map((row) => {
        const lesson = lessonMap.get(row.lesson_id);
        const course = courseMap.get(row.course_id);
        if (!lesson || !course) return null;

        return {
          lessonId: row.lesson_id,
          courseId: row.course_id,
          lessonTitle: lesson.title,
          courseTitle: course.title,
          status: row.status,
          progressPercent: row.progress_percent,
          lastViewedAt: row.last_viewed_at as string,
          href: buildLessonHref(row.course_id, lesson.slug),
        };
      })
      .filter((item): item is ActivityItem => item !== null);

    hero = recentActivity[0] ?? null;

    if (touchedCourseIdsInOrder.length > 0) {
      const { data: touchedLessonsData } = await supabase
        .from("lessons")
        .select("id, course_id")
        .in("course_id", touchedCourseIdsInOrder)
        .eq("is_published", true);

      const totalCountByCourse = new Map<string, number>();
      for (const row of touchedLessonsData ?? []) {
        totalCountByCourse.set(
          row.course_id,
          (totalCountByCourse.get(row.course_id) ?? 0) + 1
        );
      }

      const completedCountByCourse = new Map<string, number>();
      for (const row of progressRows) {
        if (row.status !== "completed") continue;
        completedCountByCourse.set(
          row.course_id,
          (completedCountByCourse.get(row.course_id) ?? 0) + 1
        );
      }

      courseProgressList = touchedCourseIdsInOrder
        .map((courseId) => {
          const course = courseMap.get(courseId);
          if (!course) return null;

          const totalCount = totalCountByCourse.get(courseId) ?? 0;
          const completedCount = completedCountByCourse.get(courseId) ?? 0;
          const percent =
            totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return {
            courseId,
            title: course.title,
            teacherName: course.support_teacher_name,
            completedCount,
            totalCount,
            percent,
            href: buildCourseHref(courseId),
          };
        })
        .filter((item): item is CourseProgressItem => item !== null);
    }

    let requiredResourceReminders: ReminderItem[] = [];

    if (inProgressLessonIds.length > 0) {
      const { data: requiredResourcesData } = await supabase
        .from("lesson_resources")
        .select("id, lesson_id, title")
        .in("lesson_id", inProgressLessonIds)
        .eq("is_required", true)
        .eq("is_published", true)
        .eq("is_deleted", false)
        .limit(5);

      requiredResourceReminders = (requiredResourcesData ?? []).map((resource) => {
        const lesson = lessonMap.get(resource.lesson_id);
        const href = lesson
          ? buildLessonHref(lesson.course_id, lesson.slug)
          : null;

        return {
          id: `resource-${resource.id}`,
          kind: "required_resource" as const,
          title: resource.title,
          subtitle: `来自：${lesson?.title ?? ""}`,
          href,
        };
      });
    }

    const { data: answeredQuestionsData } = await supabase
      .from("lesson_questions")
      .select(
        "id, title, course_id, lesson_id, teacher_name, answered_at, student_read_at, teacher_answer"
      )
      .eq("student_id", user.id)
      .not("teacher_answer", "is", null)
      .order("answered_at", { ascending: false, nullsFirst: false })
      .limit(10);

    const unreadQuestions = (answeredQuestionsData ?? []).filter(
      (row) =>
        !row.student_read_at ||
        (row.answered_at && row.student_read_at < row.answered_at)
    );

    const questionLessonIds = [
      ...new Set(unreadQuestions.map((row) => row.lesson_id)),
    ];

    const { data: questionLessonsData } =
      questionLessonIds.length > 0
        ? await supabase
            .from("lessons")
            .select("id, slug")
            .in("id", questionLessonIds)
        : { data: [] as { id: string; slug: string }[] };

    const questionLessonMap = new Map(
      (questionLessonsData ?? []).map((lesson) => [lesson.id, lesson.slug])
    );

    const teacherReplyReminders: ReminderItem[] = unreadQuestions
      .slice(0, 3)
      .map((row) => {
        const lessonSlug = questionLessonMap.get(row.lesson_id);
        const lessonHref = lessonSlug
          ? buildLessonHref(row.course_id, lessonSlug)
          : null;

        const href = lessonHref
          ? `/api/lesson-questions/${row.id}/mark-read?to=${encodeURIComponent(lessonHref)}`
          : null;

        return {
          id: `reply-${row.id}`,
          kind: "teacher_reply" as const,
          title: row.title,
          subtitle: row.teacher_name ? `${row.teacher_name} 老师已回复` : "老师已回复",
          href,
        };
      });

    reminders = [...teacherReplyReminders, ...requiredResourceReminders].slice(0, 5);
  }

  const hasWeeklyActivity = heatmapDays.some((day) => day.count > 0);
  const maxHeatmapCount = Math.max(1, ...heatmapDays.map((day) => day.count));
  const vocabularyThisWeekMinutes =
    vocabularyThisWeekSeconds > 0
      ? Math.max(1, Math.round(vocabularyThisWeekSeconds / 60))
      : 0;
  const recentCourseProgressList = courseProgressList
    .filter(
      (item): item is CourseProgressItem & { href: string } =>
        Boolean(item.href)
    )
    .slice(0, 3);
  const heroCourseProgress = hero
    ? courseProgressList.find((course) => course.courseId === hero.courseId) ?? null
    : null;
  const heroLessonProgress = hero
    ? hero.status === "completed"
      ? 100
      : Math.max(0, Math.min(100, hero.progressPercent ?? 0))
    : 0;

  const practiceTools = [
    { title: "单词练习", subtitle: "第 2 章 · 日常词汇", href: "/dashboard/toolbox/vocabulary", icon: BookText, available: true },
    { title: "口语练习", subtitle: "即将上线", href: "/dashboard/toolbox/speaking", icon: Mic, available: false },
    { title: "语法练习", subtitle: "即将上线", href: "/dashboard/toolbox/grammar", icon: BookOpen, available: false },
    { title: "听力练习", subtitle: "即将上线", href: "/dashboard/toolbox/listening", icon: Ear, available: false },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-8 pb-14 pt-9">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.15fr_0.85fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
      {/* 首屏明确区分当前课时进度与整门课程进度。 */}
      <section
        className="app-glass-card relative overflow-hidden rounded-[20px] p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end), var(--app-accent-soft))",
        }}
      >
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--app-accent-soft)" }}
            >
              <GraduationCap
                size={22}
                style={{ color: "var(--app-accent)" }}
                aria-hidden="true"
              />
            </span>
            <DashboardTitleWithHint
              className="min-w-0 flex-1"
              headingLevel={2}
              titleClassName="max-w-2xl text-xl font-black tracking-tight sm:text-2xl"
              title={`${studentName}，继续你的学习目标`}
              description={
                <>
                  {`${getGreeting()}，${studentName}`}
                  {!hero &&
                    "。你的学习档案已经准备好。选择第一门课程，我们会从第一节课开始记录成长。"}
                </>
              }
            />
          </div>

          {hero ? (
            <div
              className="mt-5 rounded-2xl border p-4"
              style={{
                borderColor: "var(--app-border-soft)",
                backgroundColor: "var(--app-card-bg)",
              }}
            >
              <p className="text-xs font-bold app-muted-text">{hero.courseTitle}</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="min-w-0 text-base font-black leading-6">{hero.lessonTitle}</p>
                <strong
                  className="shrink-0 text-lg font-black"
                  style={{ color: "var(--app-accent-strong)" }}
                >
                  {heroLessonProgress}%
                </strong>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold app-muted-text">当前课时进度</span>
                <span className="app-muted-text">{statusLabelMap[hero.status] ?? hero.status}</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--app-soft-bg)" }}
                aria-label={`当前课时进度 ${heroLessonProgress}%`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${heroLessonProgress}%`,
                    backgroundColor: "var(--app-accent)",
                  }}
                />
              </div>

              <div
                className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-sm"
                style={{ borderColor: "var(--app-border-soft)" }}
              >
                <span className="font-bold app-muted-text">这门课整体进度</span>
                <strong>
                  {heroCourseProgress
                    ? `${heroCourseProgress.completedCount} / ${heroCourseProgress.totalCount} 课时`
                    : "课程数据整理中"}
                </strong>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                  {hero.href && (
                    <Link
                      href={hero.href}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
                      style={{ backgroundColor: "var(--app-accent)" }}
                    >
                      <PlayCircle size={17} aria-hidden="true" />
                      继续上次学习
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                  <Link
                    href="/dashboard/courses"
                    className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    查看全部课程
                  </Link>
              </div>
            </div>
          ) : (
              <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--app-border-soft)" }}>
                <p className="text-sm font-bold app-muted-text">还没有课程学习进度，从第一节课开始建立你的学习记录。</p>
                <Link
                  href="/dashboard/courses"
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  挑选第一门课程
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
          )}
      </section>

          <section className="app-glass-card rounded-[20px] px-[22px] pb-6 pt-[22px]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-black">本周学习活动</p>
              <div className="flex items-center gap-2">
                <MonthlyStudyDialog
                  monthLabel={monthLabel}
                  buttonLabel="按月查看"
                  dailyMinutes={monthDailyMinutes}
                  dayTips={monthDailyTips}
                  totalMinutes={monthTotalMinutes}
                  maxMinutes={MONTHLY_DAY_STUDY_MINUTES_CAP}
                />
                <MonthlyStudyDialog
                  monthLabel={yearLabel}
                  buttonLabel="按年查看"
                  dailyMinutes={yearMonthlyMinutes}
                  dayTips={yearMonthlyTips}
                  totalMinutes={yearTotalMinutes}
                  maxMinutes={YEARLY_MONTH_STUDY_MINUTES_CAP}
                  xLabelUnit="月"
                />
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-2 px-1">
              {heatmapDays.map((day) => {
                const weekdayLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", weekday: "narrow" }).format(new Date(`${day.dateString}T12:00:00Z`));
                const barHeightPercent = hasWeeklyActivity
                  ? Math.max(6, (day.count / maxHeatmapCount) * 100)
                  : 7;
                return (
                  <div key={day.dateString} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="flex h-36 w-full max-w-9 items-end overflow-hidden rounded-2xl"
                      style={{ backgroundColor: "var(--app-soft-bg)" }}
                      title={hasWeeklyActivity ? `${day.dateString} · 完成 ${day.count} 个课时` : `${day.dateString} · 暂无活动`}
                    >
                      <div
                        className="w-full rounded-2xl transition-[height]"
                        style={{
                          height: `${hasWeeklyActivity && day.count === 0 ? 0 : barHeightPercent}%`,
                          backgroundColor: hasWeeklyActivity
                            ? "var(--app-accent)"
                            : "var(--app-border)",
                        }}
                      />
                    </div>
                    <time dateTime={day.dateString} className="text-xs font-bold app-muted-text">{weekdayLabel}</time>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                {
                  name: "单词",
                  icon: BookText,
                  status:
                    vocabularyThisWeekSeconds > 0
                      ? `本周累计 ${vocabularyThisWeekMinutes} 分钟`
                      : "本周尚未练习",
                  available: true,
                },
                { name: "语法", icon: BookOpen, status: "即将上线", available: false },
                { name: "口语", icon: Mic, status: "即将上线", available: false },
                { name: "听力", icon: Ear, status: "即将上线", available: false },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 rounded-xl border px-2.5 py-2"
                    style={{
                      borderColor: item.available
                        ? "var(--app-border)"
                        : "var(--app-border-soft)",
                      backgroundColor: item.available
                        ? "var(--app-accent-soft)"
                        : "var(--app-soft-bg)",
                      opacity: item.available ? 1 : 0.62,
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        color: item.available ? "var(--app-accent)" : "var(--app-muted)",
                        backgroundColor: "var(--app-card-bg)",
                      }}
                    >
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span
                      className="flex-1 text-xs font-bold"
                      style={{ color: item.available ? "var(--app-text)" : "var(--app-muted)" }}
                    >
                      {item.name}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-black"
                      style={{
                        color: item.available ? "var(--app-accent-strong)" : "var(--app-muted)",
                        backgroundColor: "var(--app-card-bg)",
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="app-glass-card rounded-[20px] p-4 sm:p-5">
            <p className="text-lg font-black">最近学习课程</p>

            {recentCourseProgressList.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentCourseProgressList.map((course) => (
                  <Link
                    key={course.courseId}
                    href={course.href}
                    className="block rounded-2xl p-3.5 transition hover:-translate-y-0.5"
                    style={{ backgroundColor: "var(--app-soft-bg)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{course.title}</p>
                        {course.teacherName && (
                          <p className="mt-1 truncate text-xs font-semibold app-muted-text">
                            支持教师：{course.teacherName}
                          </p>
                        )}
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black"
                        style={{
                          color: "var(--app-accent-strong)",
                          backgroundColor: "var(--app-accent-soft)",
                        }}
                      >
                        {course.percent}%
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold app-muted-text">
                      <span>
                        已完成 {course.completedCount} / {course.totalCount} 课时
                      </span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </div>
                    <div
                      className="mt-2.5 h-2 overflow-hidden rounded-full"
                      style={{ backgroundColor: "var(--app-card-bg)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, course.percent)}%`,
                          backgroundColor: "var(--app-accent)",
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="app-empty-state mt-4 flex min-h-48 flex-col items-center justify-center rounded-2xl p-5 text-center">
                <BookOpen size={25} style={{ color: "var(--app-accent)" }} aria-hidden="true" />
                <p className="mt-3 text-sm font-black">还没有课程学习进度</p>
                <p className="mt-1 max-w-xs text-xs leading-5 app-muted-text">
                  开始学习一节课程后，这里会展示你的课程完成情况
                </p>
                <Link
                  href="/dashboard/courses"
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-white"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  浏览全部课程
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>

          <section id="reminders" className="app-glass-card scroll-mt-24 rounded-[20px] p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <p className="text-lg font-black">需要你关注</p>
              <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>{reminders.length} 项</span>
            </div>
            {reminders.length > 0 ? (
              <div className="divide-y app-divider">
                {reminders.map((item) => {
                  const Icon = item.kind === "teacher_reply" ? BellRing : TriangleAlert;
                  const content = (
                    <div className="app-flat-row flex items-start gap-3 rounded-xl p-2.5 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: item.kind === "teacher_reply" ? "var(--app-accent)" : "var(--app-warm)", backgroundColor: item.kind === "teacher_reply" ? "var(--app-accent-soft)" : "var(--app-warm-soft)" }}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{item.title}</span>
                        <span className="mt-0.5 block truncate text-xs app-muted-text">{item.subtitle}</span>
                      </span>
                      <ArrowRight size={15} className="mt-2 shrink-0 app-muted-text" aria-hidden="true" />
                    </div>
                  );
                  if (!item.href) return <div key={item.id}>{content}</div>;
                  return item.kind === "teacher_reply" ? (
                    <form key={item.id} action={item.href} method="post"><button type="submit" className="block w-full">{content}</button></form>
                  ) : (
                    <Link key={item.id} href={item.href}>{content}</Link>
                  );
                })}
              </div>
            ) : (
              <div className="app-empty-state flex min-h-44 flex-col items-center justify-center rounded-2xl p-5 text-center">
                <CheckCircle2 size={25} style={{ color: "var(--app-success)" }} aria-hidden="true" />
                <p className="mt-3 text-sm font-black">目前没有待处理事项</p>
                <p className="mt-1 text-xs app-muted-text">可以安心继续今天的学习计划</p>
              </div>
            )}
          </section>

        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="app-glass-card rounded-[20px] p-5" aria-label="学习数据概览">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-black">学习概览</p>
              <span className="text-xs font-bold app-muted-text">真实学习记录</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[
                { label: "累计完成课时", value: completedLessonsCount, suffix: "课时", color: "var(--app-success)" },
                { label: "进行中课时", value: inProgressLessonsCount, suffix: "课时", color: "var(--app-accent-strong)" },
                { label: "本周已完成", value: thisWeekCompletedCount, suffix: "课时", color: "var(--app-success)" },
                { label: "学习天数", value: streakDays, suffix: "天", color: "var(--app-warm)" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border px-3 py-3.5"
                  style={{
                    borderColor: "var(--app-border-soft)",
                    backgroundColor: "var(--app-soft-bg)",
                  }}
                >
                  <p className="text-xs font-bold app-muted-text">{stat.label}</p>
                  <p
                    className="mt-1.5 text-xl font-black"
                    style={{ color: stat.value > 0 ? stat.color : "var(--app-muted)" }}
                  >
                    {stat.value} <span className="text-xs font-bold">{stat.suffix}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="app-glass-card rounded-[20px] p-4 sm:p-5">
            <div className="mb-5">
              <p className="text-lg font-black">成长工具箱</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {practiceTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="flex flex-col gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5"
                    style={{
                      backgroundColor: tool.available
                        ? "var(--app-accent-soft)"
                        : "var(--app-soft-bg)",
                      opacity: tool.available ? 1 : 0.62,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        size={20}
                        style={{ color: tool.available ? "var(--app-accent)" : "var(--app-muted)" }}
                        aria-hidden="true"
                      />
                      <ArrowRight
                        size={16}
                        className="opacity-35"
                        style={{ color: tool.available ? "var(--app-text)" : "var(--app-muted)" }}
                        aria-hidden="true"
                      />
                    </div>
                    <span
                      className="text-base font-black"
                      style={{ color: tool.available ? "var(--app-text)" : "var(--app-muted)" }}
                    >
                      {tool.title}
                    </span>
                    <span className="text-xs font-semibold app-muted-text">
                      {tool.subtitle}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {recentActivity.length > 0 && (
            <section className="app-glass-card mt-5 rounded-[20px] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <GraduationCap size={18} style={{ color: "var(--app-secondary)" }} aria-hidden="true" />
                <p className="text-lg font-black">最近学习记录</p>
              </div>
              <div className="divide-y app-divider">
                {recentActivity.slice(0, 4).map((item) => {
                  const content = (
                    <div className="flex items-center gap-3 py-3 transition hover:opacity-75">
                      {item.status === "completed" ? (
                        <CheckCircle2 size={18} className="shrink-0" style={{ color: "var(--app-success)" }} aria-hidden="true" />
                      ) : (
                        <PlayCircle size={18} className="shrink-0" style={{ color: "var(--app-accent)" }} aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{item.lessonTitle}</span>
                        <span className="mt-0.5 block truncate text-xs app-muted-text">
                          {item.courseTitle}
                        </span>
                        <span className="mt-1 block text-[10px] font-semibold app-muted-text">
                          最后学习：
                          <LocalDateTime
                            value={item.lastViewedAt}
                            options={RECENT_ACTIVITY_DATE_TIME_OPTIONS}
                          />
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-black"
                          style={{
                            color: "var(--app-accent-strong)",
                            backgroundColor: "var(--app-accent-soft)",
                          }}
                        >
                          {Math.min(100, Math.max(0, item.progressPercent))}%
                        </span>
                        <span className="text-[10px] font-bold app-muted-text">
                          {statusLabelMap[item.status] ?? item.status}
                        </span>
                      </span>
                    </div>
                  );
                  return item.href ? (
                    <Link key={item.lessonId} href={item.href}>{content}</Link>
                  ) : (
                    <div key={item.lessonId}>{content}</div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
