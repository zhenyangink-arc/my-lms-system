import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  PlayCircle,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import {
  getCourseLevelLabel,
  getLessonTypeLabel,
} from "@/lib/course-labels";


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
};

type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  lesson_type: string;
  duration_minutes: number;
  is_free_preview: boolean;
  sort_order: number;
};

type LessonProgress = {
  lesson_id: string;
  status: LessonProgressStatus;
  progress_percent: number;
};

const progressStatusLabelMap: Record<LessonProgressStatus, string> = {
  not_started: "未完成",
  in_progress: "进行中",
  completed: "已完成",
};

const accentColorMap: Record<string, string> = {
  indigo: "#6366f1",
  blue: "#2563eb",
  emerald: "#16a34a",
  purple: "#9333ea",
  orange: "#f97316",
};

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

function getStatusAccent(status: LessonProgressStatus) {
  if (status === "completed") {
    return "#16a34a";
  }

  if (status === "in_progress") {
    return "#2563eb";
  }

  return "var(--app-muted)";
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
    subcategorySlug: string;
    courseSlug: string;
  }>;
}) {
  const { categorySlug, subcategorySlug, courseSlug } = await params;

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
   * 3. 查询具体课程
   */
  const { data: courseData } = await supabase
    .from("courses")
    .select(
      "id, category_id, slug, title, description, level, icon_name, cover_url"
    )
    .eq("slug", courseSlug)
    .eq("category_id", subcategory.id)
    .eq("is_published", true)
    .maybeSingle();

  if (!courseData) {
    notFound();
  }

  const course = courseData as Course;

  /**
   * 4. 查询课程下的课时
   */
  const { data: lessonData } = await supabase
    .from("lessons")
    .select(
      "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, sort_order"
    )
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const lessons = (lessonData ?? []) as Lesson[];

  /**
   * 5. 查询当前用户的课时学习进度
   */
  let progressList: LessonProgress[] = [];

  if (!isPlatformAudit && user && lessons.length > 0) {
    const lessonIds = lessons.map((lesson) => lesson.id);

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

  const progressMap = new Map<string, LessonProgress>();

  progressList.forEach((progress) => {
    progressMap.set(progress.lesson_id, progress);
  });

  const totalLessons = lessons.length;

  const completedCount = lessons.filter((lesson) => {
    const progress = progressMap.get(lesson.id);

    return progress?.status === "completed";
  }).length;

  const courseProgressPercent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const isFocusCategory =
    parentCategory.slug === "service" || parentCategory.slug === "korean";
  const accentColor = isFocusCategory
    ? parentCategory.slug === "service"
      ? "var(--app-accent)"
      : "var(--app-secondary)"
    : accentColorMap[subcategory.accent_color ?? "indigo"] ??
      accentColorMap.indigo;

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
            href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回{subcategory.title}
          </Link>

          <span className="text-sm text-gray-300">/</span>

          <Link
            href={`/dashboard/courses/${parentCategory.slug}`}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            {parentCategory.title}
          </Link>

          <span className="text-sm text-gray-300">/</span>

          <Link
            href="/dashboard/courses"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            我的课程
          </Link>
        </div>

        {/* 课程信息 + 课程进度 */}
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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
            <div className="flex gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: "var(--app-soft-bg)",
                  borderColor: "var(--app-border)",
                  color: accentColor,
                }}
              >
                <GraduationCap size={32} />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--app-soft-bg)",
                      borderColor: "var(--app-border)",
                      color: accentColor,
                    }}
                  >
                    {subcategory.title}
                  </span>

                  {course.level && (
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--app-soft-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-text-soft)",
                      }}
                    >
                      {getCourseLevelLabel(course.level)}
                    </span>
                  )}

                  <span
                    className="rounded-full border px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--app-soft-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-text-soft)",
                    }}
                  >
                    共 {totalLessons} 个课时
                  </span>
                </div>

                <h2 className="text-2xl font-black tracking-tight text-gray-900">
                  {course.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {course.description || "暂无课程简介"}
                </p>
              </div>
            </div>

            <div className="lg:border-l lg:pl-6" style={{ borderColor: "var(--app-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">{isPlatformAudit ? "巡检模式" : "课程进度"}</p>

                  <p className="mt-1 text-xs text-gray-500">
                    {isPlatformAudit ? `共 ${totalLessons} 个课时 · 不记录进度` : `已完成 ${completedCount} / ${totalLessons} 个课时`}
                  </p>
                </div>

                <p className="text-2xl font-black tracking-tight text-gray-900">
                  {isPlatformAudit ? "只读" : `${courseProgressPercent}%`}
                </p>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full"
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
          </div>
        </section>

        {/* 课时列表 */}
        <section className="app-card rounded-3xl border p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black tracking-tight text-gray-900">
              课时列表
            </h3>

            <BookOpenCheck className="text-gray-300" size={28} />
          </div>

          {lessons.length > 0 ? (
            <div className="space-y-4">
              {lessons.map((lesson, index) => {
                const progress = progressMap.get(lesson.id);

                const status = progress?.status ?? "not_started";
                const progressPercent = progress?.progress_percent ?? 0;

                const statusLabel = progressStatusLabelMap[status];
                const lessonTypeLabel = getLessonTypeLabel(lesson.lesson_type);

                const isCompleted = status === "completed";
                const isInProgress = status === "in_progress";
                const statusAccent = getStatusAccent(status);

                return (
                  <div
                    key={lesson.id}
                    className="app-card rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex gap-4">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black"
                          style={{
                            backgroundColor: "var(--app-soft-bg)",
                            borderColor: "var(--app-border)",
                            color: statusAccent,
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={21} />
                          ) : (
                            String(index + 1).padStart(2, "0")
                          )}
                        </div>

                        <div>
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span
                              className="rounded-full border px-3 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: "var(--app-text-soft)",
                              }}
                            >
                              {lessonTypeLabel}
                            </span>

                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: "var(--app-text-soft)",
                              }}
                            >
                              <Clock size={13} />
                              {lesson.duration_minutes} 分钟
                            </span>

                            {lesson.is_free_preview && (
                              <span
                                className="rounded-full border px-3 py-1 text-xs font-semibold"
                                style={{
                                  backgroundColor: "var(--app-soft-bg)",
                                  borderColor: "var(--app-border)",
                                  color: "#16a34a",
                                }}
                              >
                                可试看
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
                              {statusLabel}
                            </span>
                          </div>

                          <h4 className="font-bold text-gray-900">
                            {lesson.title}
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-gray-500">
                            {lesson.description || "暂无课时简介"}
                          </p>
                        </div>
                      </div>

                      <div className="w-full shrink-0 lg:w-56">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{isPlatformAudit ? "巡检状态" : "学习进度"}</span>
                          <span>{isPlatformAudit ? "不记录" : `${progressPercent}%`}</span>
                        </div>

                        <div
                          className="h-2 overflow-hidden rounded-full"
                          style={{ backgroundColor: "var(--app-soft-bg)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPercent}%`,
                              backgroundColor: isCompleted
                                ? "#16a34a"
                                : "var(--app-accent)",
                            }}
                          />
                        </div>

                        <Link
                          href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
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
                          <PlayCircle size={15} />
                          {isPlatformAudit
                            ? "巡检课时"
                            : isCompleted
                            ? "复习课时"
                            : isInProgress
                              ? "继续学习"
                              : "开始学习"}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="app-empty-state rounded-2xl p-6 text-center">
              <p className="font-semibold text-gray-900">暂无课时</p>
              <p className="mt-2 text-sm text-gray-500">
                当前课程还没有发布课时。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
