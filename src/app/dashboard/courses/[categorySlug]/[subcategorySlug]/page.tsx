import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  GraduationCap,
  PlayCircle,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  accent_color: string | null;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  icon_name: string | null;
  cover_url: string | null;
  sort_order: number;
};

type Lesson = {
  id: string;
  course_id: string;
};

type LessonProgress = {
  lesson_id: string;
  status: LessonProgressStatus;
  progress_percent: number;
};

type AccentColor = {
  accent: string;
  completed: string;
  inProgress: string;
};

const accentColorMap: Record<string, AccentColor> = {
  indigo: {
    accent: "#6366f1",
    completed: "#16a34a",
    inProgress: "#2563eb",
  },
  blue: {
    accent: "#2563eb",
    completed: "#16a34a",
    inProgress: "#2563eb",
  },
  emerald: {
    accent: "#059669",
    completed: "#16a34a",
    inProgress: "#2563eb",
  },
  purple: {
    accent: "#9333ea",
    completed: "#16a34a",
    inProgress: "#2563eb",
  },
  orange: {
    accent: "#f97316",
    completed: "#16a34a",
    inProgress: "#2563eb",
  },
};

const levelLabelMap: Record<string, string> = {
  basic: "基础",
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

function getCourseLevelLabel(level: string | null | undefined) {
  if (!level) {
    return null;
  }

  return levelLabelMap[level] ?? level;
}

function resolveProgressStatus(
  status: string | null | undefined
): LessonProgressStatus {
  if (
    status === "not_started" ||
    status === "in_progress" ||
    status === "completed"
  ) {
    return status;
  }

  return "not_started";
}

function getStatusAccent({
  isCompleted,
  isInProgress,
  color,
}: {
  isCompleted: boolean;
  isInProgress: boolean;
  color: AccentColor;
}) {
  if (isCompleted) {
    return color.completed;
  }

  if (isInProgress) {
    return color.inProgress;
  }

  return "var(--app-muted)";
}

export default async function SubcategoryCoursesPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
    subcategorySlug: string;
  }>;
}) {
  const { categorySlug, subcategorySlug } = await params;

  const { supabase, user, platformProfile } = await requireActiveUser();
  const isPlatformAudit = platformProfile?.role === "platform_super_admin";

  /**
   * 1. 查询一级课程板块
   */
  const { data: parentCategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, accent_color")
    .eq("slug", categorySlug)
    .is("parent_id", null)
    .eq("is_published", true)
    .maybeSingle();

  if (!parentCategoryData) {
    notFound();
  }

  const parentCategory = parentCategoryData as CourseCategory;

  /**
   * 2. 查询二级分类
   */
  const { data: subcategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, accent_color")
    .eq("slug", subcategorySlug)
    .eq("parent_id", parentCategory.id)
    .eq("is_published", true)
    .maybeSingle();

  if (!subcategoryData) {
    notFound();
  }

  const subcategory = subcategoryData as CourseCategory;

  /**
   * 3. 查询当前二级分类下的具体课程
   */
  const { data: courseData } = await supabase
    .from("courses")
    .select(
      "id, category_id, slug, title, description, level, icon_name, cover_url, sort_order"
    )
    .eq("category_id", subcategory.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const courses = (courseData ?? []) as Course[];

  const courseIds = courses.map((course) => course.id);

  /**
   * 4. 查询这些课程下面的课时
   */
  let lessons: Lesson[] = [];

  if (courseIds.length > 0) {
    const { data: lessonData } = await supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds)
      .eq("is_published", true);

    lessons = (lessonData ?? []) as Lesson[];
  }

  const lessonIds = lessons.map((lesson) => lesson.id);

  /**
   * 5. 查询当前用户的学习进度
   */
  let progressList: LessonProgress[] = [];

  if (!isPlatformAudit && user && lessonIds.length > 0) {
    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select("lesson_id, status, progress_percent")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);

    progressList = (progressData ?? []).map((item) => ({
      lesson_id: item.lesson_id,
      status: resolveProgressStatus(item.status),
      progress_percent: item.progress_percent ?? 0,
    }));
  }

  /**
   * 6. 整理课时和进度 Map
   */
  const lessonsByCourseId = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const currentLessons = lessonsByCourseId.get(lesson.course_id) ?? [];
    currentLessons.push(lesson);
    lessonsByCourseId.set(lesson.course_id, currentLessons);
  });

  const progressMap = new Map<string, LessonProgress>();

  progressList.forEach((progress) => {
    progressMap.set(progress.lesson_id, progress);
  });

  const isFocusCategory =
    parentCategory.slug === "service" || parentCategory.slug === "korean";
  const focusAccent = parentCategory.slug === "service"
    ? "var(--app-accent)"
    : "var(--app-secondary)";
  const color = isFocusCategory
    ? {
        accent: focusAccent,
        completed: "var(--app-success)",
        inProgress: focusAccent,
      }
    : accentColorMap[
        subcategory.accent_color ?? parentCategory.accent_color ?? "indigo"
      ] ?? accentColorMap.indigo;

  /**
   * 7. 当前二级分类整体进度
   * 这里按“当前分类下全部课程的全部课时”计算。
   */
  const totalCourses = courses.length;
  const totalCourseLessons = lessons.length;

  const totalCompletedLessons = lessons.filter((lesson) => {
    const progress = progressMap.get(lesson.id);
    return progress?.status === "completed";
  }).length;

  const overallCourseProgressPercent =
    totalCourseLessons > 0
      ? Math.round((totalCompletedLessons / totalCourseLessons) * 100)
      : 0;

  return (
    <>

      <div
        className={
          isFocusCategory
            ? "mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8"
            : "space-y-5 p-5"
        }
      >
        {/* 返回路径 */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/courses/${parentCategory.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium transition"
            style={{ color: "var(--app-muted)" }}
          >
            <ArrowLeft size={16} />
            返回{parentCategory.title}
          </Link>

          <span className="text-sm" style={{ color: "var(--app-muted-light)" }}>
            /
          </span>

          <Link
            href="/dashboard/courses"
            className="text-sm font-medium transition"
            style={{ color: "var(--app-muted)" }}
          >
            我的课程
          </Link>
        </div>

        {/* 页面说明板块 */}
        <section
          className="app-card rounded-3xl border p-5 shadow-sm"
          style={
            isFocusCategory
              ? {
                  background:
                    parentCategory.slug === "service"
                      ? "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start))"
                      : "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end))",
                }
              : undefined
          }
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
            {/* 左侧：说明 */}
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--app-soft-bg)",
                    borderColor: "var(--app-border)",
                    color: color.accent,
                  }}
                >
                  {parentCategory.title}
                </span>

                <span className="app-soft-card rounded-full border px-3 py-1 text-xs font-medium">
                  {subcategory.title}
                </span>
              </div>

              <h2
                className="text-2xl font-black tracking-tight"
                style={{ color: "var(--app-text)" }}
              >
                选择具体课程
              </h2>
            </div>

            {/* 右侧：当前分类整体进度 */}
            <div className="lg:border-l lg:pl-6" style={{ borderColor: "var(--app-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-sm font-black"
                    style={{ color: "var(--app-text)" }}
                  >
                    课程进度
                  </p>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--app-muted)" }}
                  >
                    已完成 {totalCompletedLessons} / {totalCourseLessons} 个课时
                  </p>
                </div>

                <p
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "var(--app-text)" }}
                >
                  {overallCourseProgressPercent}%
                </p>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--app-soft-bg)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${overallCourseProgressPercent}%`,
                    backgroundColor: "var(--app-success)",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 课程列表板块 */}
        <section className="app-card rounded-3xl border p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3
              className="text-lg font-black tracking-tight"
              style={{ color: "var(--app-text)" }}
            >
              课程列表
            </h3>

            <span className="app-soft-card rounded-full border px-3 py-1 text-xs font-semibold">
              {totalCourses} 门课程
            </span>
          </div>

          {courses.length > 0 ? (
            <div className="space-y-4">
              {courses.map((course) => {
                const courseLessons = lessonsByCourseId.get(course.id) ?? [];

                const totalLessons = courseLessons.length;

                const completedCount = courseLessons.filter((lesson) => {
                  const progress = progressMap.get(lesson.id);
                  return progress?.status === "completed";
                }).length;

                const inProgressCount = courseLessons.filter((lesson) => {
                  const progress = progressMap.get(lesson.id);
                  return progress?.status === "in_progress";
                }).length;

                const courseProgressPercent =
                  totalLessons > 0
                    ? Math.round((completedCount / totalLessons) * 100)
                    : 0;

                const isCompleted =
                  totalLessons > 0 && completedCount === totalLessons;

                const isInProgress =
                  !isCompleted && (completedCount > 0 || inProgressCount > 0);

                const buttonLabel =
                  isPlatformAudit
                    ? "巡检课程"
                    : totalLessons === 0
                    ? "查看课程"
                    : isCompleted
                      ? "复习课程"
                      : isInProgress
                        ? "继续学习"
                        : "开始学习";

                const levelLabel = getCourseLevelLabel(course.level);

                const statusAccent = getStatusAccent({
                  isCompleted,
                  isInProgress,
                  color,
                });

                return (
                  <article
                    key={course.id}
                    className="app-card rounded-3xl border p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px_150px] lg:items-center">
                      {/* 左侧：课程信息 */}
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border"
                          style={{
                            backgroundColor: "var(--app-soft-bg)",
                            borderColor: "var(--app-border)",
                            color: isCompleted ? color.completed : color.accent,
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={28} />
                          ) : (
                            <GraduationCap size={28} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span
                              className="rounded-full border px-3 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: color.accent,
                              }}
                            >
                              {subcategory.title}
                            </span>

                            {levelLabel && (
                              <span className="app-soft-card rounded-full border px-3 py-1 text-xs font-medium">
                                {levelLabel}
                              </span>
                            )}

                            <span
                              className="rounded-full border px-3 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: statusAccent,
                              }}
                            >
                              {isCompleted
                                ? "已完成"
                                : isInProgress
                                  ? "进行中"
                                  : "未开始"}
                            </span>
                          </div>

                          <h3
                            className="text-lg font-black tracking-tight"
                            style={{ color: "var(--app-text)" }}
                          >
                            {course.title}
                          </h3>

                          <p
                            className="mt-2 line-clamp-2 text-sm leading-6"
                            style={{ color: "var(--app-muted)" }}
                          >
                            {course.description || "暂无课程简介"}
                          </p>
                        </div>
                      </div>

                      {/* 中间：学习进度 */}
                      <div className="lg:border-l lg:pl-5" style={{ borderColor: "var(--app-border)" }}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div
                            className="inline-flex items-center gap-1.5 text-xs font-medium"
                            style={{ color: "var(--app-muted)" }}
                          >
                            <Clock size={13} />
                            共 {totalLessons} 个课时
                          </div>

                          <span
                            className="text-sm font-black"
                            style={{ color: "var(--app-text)" }}
                          >
                            {courseProgressPercent}%
                          </span>
                        </div>

                        <div
                          className="mb-2 flex items-center justify-between text-xs"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <span>
                            已完成 {completedCount} / {totalLessons}
                          </span>

                          <span>
                            {isCompleted
                              ? "可以复习"
                              : isInProgress
                                ? "继续学习"
                                : "尚未开始"}
                          </span>
                        </div>

                        <div
                          className="h-2 overflow-hidden rounded-full"
                          style={{ backgroundColor: "var(--app-soft-bg)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${courseProgressPercent}%`,
                              backgroundColor: "var(--app-success)",
                            }}
                          />
                        </div>
                      </div>

                      {/* 右侧：按钮 */}
                      <Link
                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90 lg:w-auto"
                        style={{
                          backgroundColor: isCompleted
                            ? "var(--lesson-review-bg)"
                            : isInProgress
                              ? "var(--lesson-continue-bg)"
                              : "var(--lesson-start-bg)",
                          color: isCompleted
                            ? "var(--lesson-review-text)"
                            : isInProgress
                              ? "var(--lesson-continue-text)"
                              : "var(--lesson-start-text)",
                          borderColor: isCompleted
                            ? "var(--lesson-review-border)"
                            : isInProgress
                              ? "var(--lesson-continue-border)"
                              : "var(--lesson-start-border)",
                        }}
                      >
                        <PlayCircle size={16} />
                        {buttonLabel}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="app-empty-state rounded-2xl p-6 text-center">
              <p
                className="font-semibold"
                style={{ color: "var(--app-text)" }}
              >
                暂无课程
              </p>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--app-muted)" }}
              >
                当前分类下还没有发布课程。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
