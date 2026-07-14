import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  BellRing,
  BookOpen,
  CheckCircle2,
  Compass,
  Megaphone,
  PlayCircle,
  TriangleAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { DashboardPageHeader } from "./DashboardPageHeader";

type LessonProgressRow = {
  lesson_id: string;
  course_id: string;
  status: string;
  progress_percent: number;
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
  lessonTitle: string;
  courseTitle: string;
  status: string;
  progressPercent: number;
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

function toShanghaiDateString(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
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

function getShanghaiHour() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  });

  return Number(formatter.format(new Date()));
}

function getGreeting() {
  const hour = getShanghaiHour();

  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getWeekStartISOString() {
  const todayString = toShanghaiDateString(new Date());
  const todayUTC = parseDateStringToUTC(todayString);

  const weekday = new Date(todayUTC).getUTCDay();
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;

  const mondayUTC = todayUTC - diffToMonday * 86400000;

  return new Date(mondayUTC - 8 * 60 * 60 * 1000).toISOString();
}

function calculateStreak(completedDateStrings: string[]) {
  const daySet = new Set(completedDateStrings);
  const todayString = toShanghaiDateString(new Date());

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

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let studentName = "同学";
  let recentActivity: ActivityItem[] = [];
  let completedLessonsCount = 0;
  let activeCoursesCount = 0;
  let totalCoursesCount = 0;
  let streakDays = 0;
  let heroProgressPercent = 0;
  let hero: ActivityItem | null = null;
  let reminders: ReminderItem[] = [];
  let recommendedCourses: { id: string; title: string; level: string | null; href: string | null }[] = [];
  const heatmapDays: { dateString: string; count: number }[] = [];
  let courseProgressList: CourseProgressItem[] = [];

  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    studentName = profileData?.full_name || "同学";

    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select(
        "lesson_id, course_id, status, progress_percent, last_viewed_at, completed_at"
      )
      .eq("user_id", user.id);

    const progressRows = (progressData ?? []) as LessonProgressRow[];

    completedLessonsCount = progressRows.filter(
      (row) => row.status === "completed"
    ).length;

    activeCoursesCount = new Set(progressRows.map((row) => row.course_id)).size;

    const weekStart = getWeekStartISOString();
    const thisWeekCompletedCount = progressRows.filter(
      (row) =>
        row.status === "completed" &&
        row.completed_at &&
        row.completed_at >= weekStart
    ).length;
    void thisWeekCompletedCount;

    const completedDateStrings = progressRows
      .filter((row) => row.status === "completed" && row.completed_at)
      .map((row) => toShanghaiDateString(new Date(row.completed_at as string)));

    streakDays = calculateStreak(completedDateStrings);

    const countByDate = new Map<string, number>();
    for (const dateString of completedDateStrings) {
      countByDate.set(dateString, (countByDate.get(dateString) ?? 0) + 1);
    }

    const todayUTC = parseDateStringToUTC(toShanghaiDateString(new Date()));
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
    const touchedCourseIds = new Set(touchedCourseIdsInOrder);

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
    totalCoursesCount = allCourses.length;

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
          lessonTitle: lesson.title,
          courseTitle: course.title,
          status: row.status,
          progressPercent: row.progress_percent,
          href: buildLessonHref(row.course_id, lesson.slug),
        };
      })
      .filter((item): item is ActivityItem => item !== null);

    hero = recentActivity[0] ?? null;

    if (hero && sortedByRecent[0]) {
      const heroCourseId = sortedByRecent[0].course_id;

      const { count: publishedLessonCount } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("course_id", heroCourseId)
        .eq("is_published", true);

      const courseCompletedCount = progressRows.filter(
        (row) => row.course_id === heroCourseId && row.status === "completed"
      ).length;

      heroProgressPercent =
        publishedLessonCount && publishedLessonCount > 0
          ? Math.round((courseCompletedCount / publishedLessonCount) * 100)
          : 0;
    }

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

    recommendedCourses = allCourses
      .filter((course) => !touchedCourseIds.has(course.id))
      .slice(0, 3)
      .map((course) => ({
        id: course.id,
        title: course.title,
        level: course.level,
        href: buildCourseHref(course.id),
      }));

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

  const ringRadius = 27;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - heroProgressPercent / 100);

  const maxHeatmapCount = Math.max(1, ...heatmapDays.map((day) => day.count));

  function heatmapOpacity(count: number) {
    if (count === 0) return 0.08;
    const ratio = count / maxHeatmapCount;
    return 0.3 + ratio * 0.7;
  }

  return (
    <>
      <DashboardPageHeader
        title="学生控制台"
        description="这里是你的学习、申请和签证准备总览。"
        action={
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: "var(--app-accent)" }}
          >
            浏览课程
          </Link>
        }
      />

      <div className="w-full space-y-4 p-6">
        <div>
          <p className="text-sm app-muted-text">
            {getGreeting()}，{studentName}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
            继续你的留学准备之旅
          </h2>
        </div>

        {/*
          主网格布局

          按参考图的排列方式，用一个 2 列 CSS Grid，"我的课程" 用 row-span-2
          竖跨两行，其余板块按文档顺序自然排列（CSS Grid 默认按顺序自动填格，
          遇到已被跨行占用的格子会自动跳过，不需要手动写每个格子的行号）。
        */}
        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          {/* 欢迎区域（这里放最近学习主卡片，兼具"继续学习"引导作用） */}
          {hero ? (
            <div className="app-card overflow-hidden rounded-3xl border shadow-sm">
              <div className="grid h-full gap-0 sm:grid-cols-[1fr_auto_110px]">
                <div className="p-5">
                  <p className="text-xs font-semibold app-muted-text">
                    最近学习 · {hero.courseTitle}
                  </p>
                  <h3 className="mt-2 text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    {hero.lessonTitle}
                  </h3>
                  <p className="mt-2 text-sm app-muted-text">
                    {statusLabelMap[hero.status] ?? hero.status}
                    {hero.progressPercent > 0 && ` · 上次学到 ${hero.progressPercent}%`}
                  </p>
                  {hero.href && (
                    <Link
                      href={hero.href}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                      style={{ backgroundColor: "var(--app-accent)" }}
                    >
                      <PlayCircle size={16} />
                      继续学习
                      <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
                <div className="hidden sm:block" style={{ borderLeft: "1px dashed var(--app-border)" }} />
                <div className="flex flex-col items-center justify-center gap-2 p-4">
                  <div className="relative h-14 w-14">
                    <svg width="56" height="56" viewBox="0 0 64 64" className="-rotate-90">
                      <circle cx="32" cy="32" r={ringRadius} fill="none" stroke="var(--app-border)" strokeWidth="7" />
                      <circle
                        cx="32"
                        cy="32"
                        r={ringRadius}
                        fill="none"
                        stroke="var(--app-accent)"
                        strokeWidth="7"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: "var(--app-text)" }}>
                      {heroProgressPercent}%
                    </span>
                  </div>
                  <span className="text-xs app-muted-text">课程进度</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="app-card flex flex-col items-center justify-center gap-3 rounded-3xl border p-8 text-center shadow-sm">
              <div className="app-soft-card flex h-12 w-12 items-center justify-center rounded-2xl border">
                <BookOpen size={22} style={{ color: "var(--app-accent)" }} />
              </div>
              <h3 className="text-base font-black" style={{ color: "var(--app-text)" }}>开始你的第一课</h3>
              <p className="max-w-xs text-sm app-muted-text">还没有学习记录，浏览课程列表，选一门课开始你的留学准备。</p>
              <Link
                href="/dashboard/courses"
                className="mt-1 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: "var(--app-accent)" }}
              >
                浏览课程
                <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {/* 我的课程：竖跨两行，右侧独立面板 */}
          <div className="app-card row-span-2 rounded-3xl border p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black" style={{ color: "var(--app-text)" }}>我的课程</p>
              <Link href="/dashboard/courses" className="text-xs font-semibold" style={{ color: "var(--app-accent)" }}>
                查看全部
              </Link>
            </div>

            {courseProgressList.length > 0 ? (
              <div className="space-y-2.5">
                {courseProgressList.map((item) => (
                  <div key={item.courseId} className="app-soft-card rounded-2xl border p-3">
                    <div className="flex items-center gap-3">
                      <div className="app-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
                        <BookOpen size={16} style={{ color: "var(--app-accent)" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" style={{ color: "var(--app-text)" }}>
                          {item.title}
                        </p>
                        <p className="truncate text-xs app-muted-text">
                          {item.teacherName ? `${item.teacherName} 老师` : "暂无老师信息"} · 进度 {item.percent}%
                        </p>
                      </div>
                    </div>
                    {item.href && (
                      <Link
                        href={item.href}
                        className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                        style={{ backgroundColor: "var(--app-accent)" }}
                      >
                        继续学习
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm app-muted-text">还没有正在学习的课程。</p>
            )}
          </div>

          {/* 统计条：总课程数/进行中课程/已完成课时/连续学习 */}
          <div className="app-soft-card grid grid-cols-2 divide-x rounded-2xl border sm:grid-cols-4" style={{ borderColor: "var(--app-border)" }}>
            <div className="p-4">
              <p className="text-xs font-semibold app-muted-text">总课程数</p>
              <p className="mt-1.5 text-xl font-black" style={{ color: "var(--app-text)" }}>{totalCoursesCount}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold app-muted-text">进行中课程</p>
              <p className="mt-1.5 text-xl font-black" style={{ color: "var(--app-text)" }}>{activeCoursesCount}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold app-muted-text">已完成课程</p>
              <p className="mt-1.5 text-xl font-black" style={{ color: "var(--app-text)" }}>{completedLessonsCount}</p>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold app-muted-text">连续学习</p>
              <p className="mt-1.5 text-xl font-black" style={{ color: "var(--app-text)" }}>{streakDays} 天</p>
            </div>
          </div>

          {/* 待办事项：合并真实提醒 + 未来作业/考试占位 */}
          <div className="app-card rounded-3xl border p-5 shadow-sm">
            <p className="mb-3 text-sm font-black" style={{ color: "var(--app-text)" }}>待办事项</p>

            {reminders.length > 0 ? (
              <div className="space-y-3">
                {reminders.map((item) => {
                  const Icon = item.kind === "teacher_reply" ? BellRing : TriangleAlert;
                  const content = (
                    <div
                      className="flex items-start gap-2.5 border-l-2 pl-2.5 py-0.5 transition hover:opacity-80"
                      style={{ borderColor: item.kind === "teacher_reply" ? "var(--app-accent)" : "var(--app-border)" }}
                    >
                      <Icon
                        size={15}
                        className="mt-0.5 shrink-0"
                        style={{ color: item.kind === "teacher_reply" ? "var(--app-accent)" : "#d97706" }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: "var(--app-text)" }}>{item.title}</p>
                        <p className="truncate text-xs app-muted-text">{item.subtitle}</p>
                      </div>
                    </div>
                  );

                  if (!item.href) return <div key={item.id}>{content}</div>;

                  return item.kind === "teacher_reply" ? (
                    <form key={item.id} action={item.href} method="post">
                      <button type="submit" className="block w-full text-left">
                        {content}
                      </button>
                    </form>
                  ) : (
                    <Link key={item.id} href={item.href}>{content}</Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm app-muted-text">暂无待处理事项。</p>
            )}

            <p className="mt-3 border-t pt-3 text-xs app-muted-text" style={{ borderColor: "var(--app-border)" }}>
              作业和考试的截止提醒即将上线。
            </p>
          </div>

          {/* 学习能力进度（占位） */}
          <div className="app-card rounded-3xl border p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border">
                <Activity size={17} className="app-muted-text" />
              </div>
              <div>
                <p className="text-sm font-black" style={{ color: "var(--app-text)" }}>学习能力进度</p>
                <p className="mt-0.5 text-xs app-muted-text">听、说、读、写四项能力分析</p>
              </div>
            </div>
            <span className="mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold app-muted-text" style={{ borderColor: "var(--app-border)" }}>
              敬请期待
            </span>
          </div>

          {/* 最近成绩（占位） */}
          <div className="app-card rounded-3xl border p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border">
                <Award size={17} className="app-muted-text" />
              </div>
              <div>
                <p className="text-sm font-black" style={{ color: "var(--app-text)" }}>最近成绩</p>
                <p className="mt-0.5 text-xs app-muted-text">测验、作业和考试成绩汇总</p>
              </div>
            </div>
            <span className="mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold app-muted-text" style={{ borderColor: "var(--app-border)" }}>
              敬请期待
            </span>
          </div>

          {/* 通知公告（占位，链接到侧边栏对应页面） */}
          <Link href="/dashboard/announcements" className="app-card rounded-3xl border p-5 shadow-sm transition hover:opacity-90">
            <div className="flex items-center gap-2.5">
              <div className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border">
                <Megaphone size={17} className="app-muted-text" />
              </div>
              <div>
                <p className="text-sm font-black" style={{ color: "var(--app-text)" }}>通知公告</p>
                <p className="mt-0.5 text-xs app-muted-text">课程、考试和系统通知</p>
              </div>
            </div>
            <span className="mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold app-muted-text" style={{ borderColor: "var(--app-border)" }}>
              敬请期待
            </span>
          </Link>

          {/* 本周学习安排：复用现有的打卡热力图数据 */}
          <div className="app-card rounded-3xl border p-5 shadow-sm">
            <p className="mb-3 text-sm font-black" style={{ color: "var(--app-text)" }}>本周节奏</p>
            <div className="grid grid-cols-7 gap-1.5">
              {heatmapDays.map((day) => (
                <div
                  key={day.dateString}
                  title={`${day.dateString} · 完成 ${day.count} 个课时`}
                  className="flex aspect-square items-center justify-center rounded-md text-[11px] font-bold"
                  style={{
                    backgroundColor: "var(--app-accent)",
                    opacity: heatmapOpacity(day.count),
                    color: day.count > 0 ? "#ffffff" : "var(--app-muted)",
                  }}
                >
                  {day.count > 0 ? day.count : ""}
                </div>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1.5">
              {heatmapDays.map((day) => {
                const weekdayLabel = new Intl.DateTimeFormat("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  weekday: "narrow",
                }).format(new Date(`${day.dateString}T12:00:00Z`));
                return (
                  <span key={day.dateString} className="text-center text-[10px] app-muted-text">
                    {weekdayLabel}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* 推荐继续 + 最近学习记录（独立于主网格，保留原样） */}
        {(recommendedCourses.length > 0 || recentActivity.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {recommendedCourses.length > 0 && (
              <div className="app-card rounded-3xl border p-5 shadow-sm">
                <p className="mb-3 flex items-center gap-2 text-sm font-black" style={{ color: "var(--app-text)" }}>
                  <Compass size={15} style={{ color: "var(--app-accent)" }} />
                  推荐继续
                </p>
                <div className="space-y-1">
                  {recommendedCourses.map((course) => {
                    const content = (
                      <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition hover:opacity-80">
                        <BookOpen size={15} style={{ color: "var(--app-accent)" }} />
                        <span className="flex-1 truncate text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                          {course.title}
                        </span>
                        {course.level && <span className="shrink-0 text-xs app-muted-text">{course.level}</span>}
                      </div>
                    );
                    return course.href ? (
                      <Link key={course.id} href={course.href}>{content}</Link>
                    ) : (
                      <div key={course.id}>{content}</div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentActivity.length > 0 && (
              <div className="app-card rounded-3xl border p-5 shadow-sm">
                <p className="mb-3 text-sm font-black" style={{ color: "var(--app-text)" }}>最近学习记录</p>
                <div className="space-y-1">
                  {recentActivity.map((item) => {
                    const content = (
                      <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition hover:opacity-80">
                        {item.status === "completed" ? (
                          <CheckCircle2 size={15} className="shrink-0 text-green-600" />
                        ) : (
                          <PlayCircle size={15} className="shrink-0" style={{ color: "var(--app-accent)" }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ color: "var(--app-text)" }}>{item.lessonTitle}</p>
                          <p className="truncate text-xs app-muted-text">{item.courseTitle}</p>
                        </div>
                        <span className="shrink-0 text-xs app-muted-text">{statusLabelMap[item.status] ?? item.status}</span>
                      </div>
                    );
                    return item.href ? (
                      <Link key={item.lessonId} href={item.href}>{content}</Link>
                    ) : (
                      <div key={item.lessonId}>{content}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
