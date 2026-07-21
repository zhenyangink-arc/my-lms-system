import Link from "next/link";
import {
  Award,
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  ClipboardList,
  FileCheck2,
  Flame,
  GraduationCap,
  History,
  Library,
  Megaphone,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getAnnouncementAccess } from "@/lib/announcements";
import { requireActiveUser } from "@/lib/auth";


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

export default async function DashboardPage() {
  const auth = await requireActiveUser();
  const isPlatformAudit = auth.platformProfile?.role === "platform_super_admin";
  const supabase = await createClient();
  const { canAccess: canAccessAnnouncements } = await getAnnouncementAccess();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let studentName = "同学";
  let recentActivity: ActivityItem[] = [];
  let completedLessonsCount = 0;
  let activeCoursesCount = 0;
  let totalCoursesCount = 0;
  let streakDays = 0;
  let thisWeekCompletedCount = 0;
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

    studentName =
      profileData?.full_name || user.user_metadata?.name || user.email || "同学";

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

    activeCoursesCount = new Set(
      progressRows
        .filter((row) => row.status === "in_progress")
        .map((row) => row.course_id)
    ).size;

    const weekStart = getWeekStartISOString();
    thisWeekCompletedCount = progressRows.filter(
      (row) =>
        row.status === "completed" &&
        row.completed_at &&
        row.completed_at >= weekStart
    ).length;

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

  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - heroProgressPercent / 100);
  const maxHeatmapCount = Math.max(1, ...heatmapDays.map((day) => day.count));

  // 本周学习节奏图表：用真实的近七天完成课时数据画出平滑折线，呼应 iBanko 的 Money Flow 图表。
  const weeklyChartWidth = 640;
  const weeklyChartHeight = 180;
  const weeklyChartPadX = 16;
  const weeklyChartPadTop = 34;
  const weeklyChartPadBottom = 26;
  const weeklyPlotWidth = weeklyChartWidth - weeklyChartPadX * 2;
  const weeklyPlotHeight = weeklyChartHeight - weeklyChartPadTop - weeklyChartPadBottom;

  const weeklyPoints = heatmapDays.map((day, index) => {
    const x =
      heatmapDays.length > 1
        ? weeklyChartPadX + (index / (heatmapDays.length - 1)) * weeklyPlotWidth
        : weeklyChartPadX + weeklyPlotWidth / 2;
    const y =
      weeklyChartPadTop + weeklyPlotHeight - (day.count / maxHeatmapCount) * weeklyPlotHeight;
    return { x, y, day };
  });

  const weeklyLinePath = weeklyPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const weeklyAreaBaseline = weeklyChartHeight - weeklyChartPadBottom;
  const weeklyAreaPath =
    weeklyPoints.length > 0
      ? `${weeklyLinePath} L ${weeklyPoints[weeklyPoints.length - 1].x.toFixed(1)} ${weeklyAreaBaseline} L ${weeklyPoints[0].x.toFixed(1)} ${weeklyAreaBaseline} Z`
      : "";

  const weeklyPeakPoint = weeklyPoints.reduce(
    (peak, point) => (point.day.count > peak.day.count ? point : peak),
    weeklyPoints[0]
  );
  const hasWeeklyActivity = heatmapDays.some((day) => day.count > 0);

  const overviewStats = [
    {
      label: "全部课程",
      value: totalCoursesCount,
      suffix: "门",
      icon: BookOpen,
      color: "var(--app-secondary)",
      softColor: "var(--app-secondary-soft)",
    },
    {
      label: "正在学习",
      value: activeCoursesCount,
      suffix: "门",
      icon: PlayCircle,
      color: "var(--app-accent)",
      softColor: "var(--app-accent-soft)",
    },
    {
      label: "本周完成",
      value: thisWeekCompletedCount,
      suffix: "课时",
      icon: CalendarDays,
      color: "var(--app-success)",
      softColor: "var(--app-success-soft)",
    },
    {
      label: "连续学习",
      value: streakDays,
      suffix: "天",
      icon: Flame,
      color: "var(--app-warm)",
      softColor: "var(--app-warm-soft)",
    },
  ];

  const studyAbroadSteps = [
    {
      label: "第一步",
      title: "明确目标大学",
      href: "/dashboard/universities",
      icon: Target,
    },
    {
      label: "第二步",
      title: "完善申请材料",
      href: "/dashboard/documents",
      icon: FileCheck2,
    },
    {
      label: "第三步",
      title: "推进签证准备",
      href: "/dashboard/visa",
      icon: ShieldCheck,
    },
  ];

  const growthTools = [
    {
      title: "作业与考试",
      href: "/dashboard/assignments",
      icon: ClipboardList,
      color: "var(--app-accent)",
      softColor: "var(--app-accent-soft)",
    },
    {
      title: "会话练习",
      href: "/dashboard/conversation-practice",
      icon: MessageSquare,
      color: "var(--app-secondary)",
      softColor: "var(--app-secondary-soft)",
    },
    {
      title: "成绩管理",
      href: "/dashboard/grades",
      icon: Award,
      color: "var(--app-warm)",
      softColor: "var(--app-warm-soft)",
    },
    {
      title: "学习记录",
      href: "/dashboard/records",
      icon: History,
      color: "var(--app-success)",
      softColor: "var(--app-success-soft)",
    },
    {
      title: "学习资料库",
      href: "/dashboard/library",
      icon: Library,
      color: "var(--app-secondary)",
      softColor: "var(--app-secondary-soft)",
    },
    ...(canAccessAnnouncements
      ? [
          {
            title: "通知公告",
            href: "/dashboard/announcements",
            icon: Megaphone,
            color: "var(--app-accent)",
            softColor: "var(--app-accent-soft)",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {isPlatformAudit && <section className="rounded-2xl border p-4" style={{ borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={18} style={{ color: "var(--app-accent)" }} /><div><p className="text-sm font-black">学生端前台巡检</p><p className="app-muted-text mt-1 text-xs leading-5">你看到的是学生端真实界面，但平台负责人不会被当作学生，也不会产生学习进度、提问或提交记录。</p></div></div></section>}
      {/* 首屏只强调一个下一步，让用户打开控制台后马上知道该做什么。跟其他卡片一样走浅色玻璃质感，不用突兀的深色板块，也不加装饰色块。 */}
      <section className="app-card relative overflow-hidden rounded-3xl border p-4 sm:p-5 lg:p-3 lg:pl-8">
        <div className="relative grid items-stretch gap-6 lg:grid-cols-[1fr_330px]">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold"
              style={{
                color: "var(--app-accent-strong)",
                borderColor: "var(--app-accent)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              <Sparkles size={14} aria-hidden="true" />
              {isPlatformAudit ? "前台体验巡检" : "今日成长计划"}
            </span>
            <p className="mt-5 text-sm font-bold app-muted-text">
              {isPlatformAudit ? "平台负责人 · 上帝视角" : `${getGreeting()}，${studentName}`}
            </p>
            <h1 className="mt-1 max-w-2xl text-2xl font-black tracking-tight">
              {isPlatformAudit ? "以学生看到的真实界面检查平台内容" : "让今天的学习，继续靠近你的韩国留学目标"}
            </h1>

            {hero ? (
              <div className="mt-5">
                <div className="flex flex-wrap gap-3">
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
              <div className="mt-5">
                <p className="max-w-xl text-sm leading-6 app-muted-text">
                  你的学习档案已经准备好。选择第一门课程，我们会从第一节课开始记录成长。
                </p>
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
          </div>

          <div className="grid h-full grid-cols-[118px_1fr] items-center gap-5 lg:border-l lg:pl-8" style={{ borderColor: "var(--app-border)" }}>
            <div className="relative h-[108px] w-[108px]" aria-label={`当前课程进度 ${heroProgressPercent}%`}>
              <svg width="108" height="108" viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="var(--app-soft-bg)" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--app-success)"
                  strokeWidth="9"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl font-black">{heroProgressPercent}%</strong>
                <span className="text-xs app-muted-text">课程进度</span>
              </span>
            </div>
            <div>
              <p className="text-xs font-bold app-muted-text">成长概览</p>
              <p className="mt-1 text-2xl font-black">{completedLessonsCount}</p>
              <p className="text-xs app-muted-text">累计完成课时</p>
              <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs app-muted-text">本周已完成</p>
                <p className="mt-0.5 font-black" style={{ color: "var(--app-success)" }}>
                  {thisWeekCompletedCount} 个课时
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:max-w-[50%]" aria-label="学习数据概览">
        {overviewStats.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl p-4 sm:p-3"
              style={{ backgroundColor: item.softColor, boxShadow: "var(--app-shadow)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: item.color }}>
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-black" style={{ color: "var(--app-text)" }}>
                    {item.value}
                    <span className="ml-1 text-xs font-bold app-muted-text">{item.suffix}</span>
                  </p>
                </div>
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ color: item.color, backgroundColor: "rgba(255, 255, 255, 0.65)" }}
                >
                  <Icon size={19} aria-hidden="true" />
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 参考 iBanko：主内容占据更宽的左列，右侧留出常驻的窄栏放需要关注的信息。 */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="app-card rounded-3xl border p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-black">课程成长进度</p>
              </div>
              <Link href="/dashboard/courses" className="text-xs font-black" style={{ color: "var(--app-accent-strong)" }}>
                全部课程
              </Link>
            </div>

            {courseProgressList.length > 0 ? (
              <div className="divide-y app-divider">
                {courseProgressList.slice(0, 4).map((item) => {
                  const content = (
                    <div className="app-flat-row rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
                        >
                          <BookOpen size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-black">{item.title}</p>
                            <span className="shrink-0 text-xs font-black" style={{ color: "var(--app-success)" }}>
                              {item.percent}%
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs app-muted-text">
                            {item.teacherName ? `${item.teacherName} 老师` : "课程学习"} · 已完成 {item.completedCount}/{item.totalCount} 课时
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                            <div
                              className="h-full rounded-full transition-[width]"
                              style={{
                                width: `${Math.min(100, Math.max(0, item.percent))}%`,
                                backgroundColor: "var(--app-success)",
                              }}
                            />
                          </div>
                        </div>
                        <ArrowRight size={16} className="shrink-0 app-muted-text" aria-hidden="true" />
                      </div>
                    </div>
                  );

                  return item.href ? (
                    <Link key={item.courseId} href={item.href}>{content}</Link>
                  ) : (
                    <div key={item.courseId}>{content}</div>
                  );
                })}
              </div>
            ) : (
              <div className="app-empty-state flex min-h-52 flex-col items-center justify-center rounded-2xl p-5 text-center">
                <BookOpen size={24} style={{ color: "var(--app-secondary)" }} aria-hidden="true" />
                <p className="mt-3 text-sm font-black">还没有进行中的课程</p>
                <p className="mt-1 text-xs app-muted-text">从课程中心挑选适合你的学习内容</p>
                <Link href="/dashboard/courses" className="mt-4 text-xs font-black" style={{ color: "var(--app-accent-strong)" }}>
                  去看看课程
                </Link>
              </div>
            )}
          </section>

          <section className="app-card rounded-3xl border p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black">本周学习节奏</p>
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}
              >
                <BarChart3 size={19} aria-hidden="true" />
              </span>
            </div>

            {hasWeeklyActivity ? (
              <div className="relative mt-6">
                {weeklyPeakPoint && weeklyPeakPoint.day.count > 0 && (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black shadow-lg"
                    style={{
                      left: `${(weeklyPeakPoint.x / weeklyChartWidth) * 100}%`,
                      top: `${(weeklyPeakPoint.y / weeklyChartHeight) * 100}%`,
                      marginTop: "-8px",
                      backgroundColor: "var(--app-text)",
                      color: "var(--app-card-bg)",
                    }}
                  >
                    {weeklyPeakPoint.day.count} 课时
                  </div>
                )}
                <svg
                  viewBox={`0 0 ${weeklyChartWidth} ${weeklyChartHeight}`}
                  preserveAspectRatio="none"
                  className="h-56 w-full overflow-visible"
                  role="img"
                  aria-label="近七天完成课时折线图"
                >
                  <defs>
                    <linearGradient id="weeklyRhythmArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--app-accent)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--app-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={weeklyAreaPath} fill="url(#weeklyRhythmArea)" stroke="none" />
                  <path
                    d={weeklyLinePath}
                    fill="none"
                    stroke="var(--app-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {weeklyPoints.map((point) => (
                    <circle
                      key={point.day.dateString}
                      cx={point.x}
                      cy={point.y}
                      r={point.day.dateString === weeklyPeakPoint.day.dateString ? 5 : 3.5}
                      fill={point.day.count > 0 ? "var(--app-accent)" : "var(--app-card-bg)"}
                      stroke="var(--app-accent)"
                      strokeWidth="2"
                    >
                      <title>{`${point.day.dateString} · 完成 ${point.day.count} 个课时`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="mt-2 flex items-center justify-between">
                  {heatmapDays.map((day) => {
                    const weekdayLabel = new Intl.DateTimeFormat("zh-CN", {
                      timeZone: "Asia/Seoul",
                      weekday: "narrow",
                    }).format(new Date(`${day.dateString}T12:00:00Z`));

                    return (
                      <time
                        key={day.dateString}
                        dateTime={day.dateString}
                        className="flex-1 text-center text-xs font-bold app-muted-text"
                      >
                        {weekdayLabel}
                      </time>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="app-empty-state mt-6 flex min-h-40 flex-col items-center justify-center rounded-2xl p-5 text-center">
                <BarChart3 size={22} style={{ color: "var(--app-success)" }} aria-hidden="true" />
                <p className="mt-3 text-sm font-black">本周还没有学习记录</p>
                <p className="mt-1 text-xs app-muted-text">完成一节课时，这里就会画出你的学习曲线</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--app-success-soft)" }}>
              <span className="text-xs font-bold app-muted-text">本周累计</span>
              <strong style={{ color: "var(--app-success)" }}>{thisWeekCompletedCount} 个课时</strong>
            </div>
          </section>

          <section className="app-card rounded-3xl border p-4 sm:p-5">
            <div className="mb-5">
              <p className="text-lg font-black">韩国留学准备路线</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {studyAbroadSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Link
                    key={step.href}
                    href={step.href}
                    className="app-tile group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-1"
                  >
                    {index < studyAbroadSteps.length - 1 && (
                      <span className="absolute right-3 top-4 hidden text-lg app-muted-text md:block">→</span>
                    )}
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{
                        color: index === 0 ? "var(--app-secondary)" : index === 1 ? "var(--app-accent)" : "var(--app-success)",
                        backgroundColor: index === 0 ? "var(--app-secondary-soft)" : index === 1 ? "var(--app-accent-soft)" : "var(--app-success-soft)",
                      }}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="mt-4 block text-xs font-black tracking-[0.16em] app-muted-text">{step.label}</span>
                    <span className="mt-1 block text-sm font-black">{step.title}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="app-card rounded-3xl border p-4 sm:p-5">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-lg font-black">成长工具箱</p>
              </div>
              <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>
                持续建设中
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {growthTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="app-tile flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{ color: tool.color, backgroundColor: tool.softColor }}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black">{tool.title}</span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 app-muted-text" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>

          {recentActivity.length > 0 && (
            <section className="app-card rounded-3xl border p-4 sm:p-5">
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
                        <span className="mt-0.5 block truncate text-xs app-muted-text">{item.courseTitle}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold app-muted-text">
                        {statusLabelMap[item.status] ?? item.status}
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

        {/* 常驻右侧窄栏：呼应 iBanko 右列一直可见的 Transactions / Available Card。 */}
        <div className="space-y-5 xl:col-span-1 xl:sticky xl:top-[92px] xl:self-start">
          <section id="reminders" className="app-card scroll-mt-24 rounded-3xl border p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black">需要你关注</p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-black"
                style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
              >
                {reminders.length} 项
              </span>
            </div>

            {reminders.length > 0 ? (
              <div className="divide-y app-divider">
                {reminders.map((item) => {
                  const Icon = item.kind === "teacher_reply" ? BellRing : TriangleAlert;
                  const content = (
                    <div className="app-flat-row flex items-start gap-3 rounded-xl p-2.5 text-left">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          color: item.kind === "teacher_reply" ? "var(--app-accent)" : "var(--app-warm)",
                          backgroundColor: item.kind === "teacher_reply" ? "var(--app-accent-soft)" : "var(--app-warm-soft)",
                        }}
                      >
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
                    <form key={item.id} action={item.href} method="post">
                      <button type="submit" className="block w-full">{content}</button>
                    </form>
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

          {recommendedCourses.length > 0 && (
            <section className="app-card rounded-3xl border p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Compass size={18} style={{ color: "var(--app-accent)" }} aria-hidden="true" />
                <p className="text-lg font-black">为你推荐</p>
              </div>
              <div className="divide-y app-divider">
                {recommendedCourses.map((course) => {
                  const content = (
                    <div className="app-flat-row flex items-center gap-3 rounded-xl p-2.5">
                      <BookOpen size={17} className="shrink-0" style={{ color: "var(--app-secondary)" }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm font-black">{course.title}</span>
                      {course.level && <span className="shrink-0 text-xs font-bold app-muted-text">{course.level}</span>}
                    </div>
                  );
                  return course.href ? (
                    <Link key={course.id} href={course.href}>{content}</Link>
                  ) : (
                    <div key={course.id}>{content}</div>
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
