import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  PlayCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { DashboardPageHeader } from "../../../DashboardPageHeader";

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

const colorMap: Record<
  string,
  {
    iconBox: string;
    iconText: string;
    badge: string;
    progress: string;
  }
> = {
  indigo: {
    iconBox: "bg-indigo-50",
    iconText: "text-indigo-600",
    badge: "bg-indigo-50 text-indigo-600",
    progress: "bg-indigo-600",
  },
  blue: {
    iconBox: "bg-blue-50",
    iconText: "text-blue-600",
    badge: "bg-blue-50 text-blue-600",
    progress: "bg-blue-600",
  },
  emerald: {
    iconBox: "bg-emerald-50",
    iconText: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-600",
    progress: "bg-emerald-600",
  },
  purple: {
    iconBox: "bg-purple-50",
    iconText: "text-purple-600",
    badge: "bg-purple-50 text-purple-600",
    progress: "bg-purple-600",
  },
  orange: {
    iconBox: "bg-orange-50",
    iconText: "text-orange-600",
    badge: "bg-orange-50 text-orange-600",
    progress: "bg-orange-500",
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

export default async function SubcategoryCoursesPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
    subcategorySlug: string;
  }>;
}) {
  const { categorySlug, subcategorySlug } = await params;

  const supabase = await createClient();

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let progressList: LessonProgress[] = [];

  if (user && lessonIds.length > 0) {
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

  const color =
    colorMap[subcategory.accent_color ?? parentCategory.accent_color ?? "indigo"] ??
    colorMap.indigo;

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
      <DashboardPageHeader
        title={subcategory.title}
        description={subcategory.description || "选择具体课程并查看学习进度。"}
      />

      <div className="space-y-6 p-6">
        {/* 返回路径 */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/courses/${parentCategory.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回{parentCategory.title}
          </Link>

          <span className="text-sm text-gray-300">/</span>

          <Link
            href="/dashboard/courses"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            我的课程
          </Link>
        </div>

        {/* 页面说明板块 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
            {/* 左侧：说明 */}
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                >
                  {parentCategory.title}
                </span>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {subcategory.title}
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                选择具体课程
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                每门课程会显示当前账号的学习进度。你可以从这里查看课程完成率，并继续学习未完成的课程。
              </p>
            </div>

            {/* 右侧：当前分类整体进度 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">课程进度</p>

                  <p className="mt-1 text-xs text-gray-500">
                    已完成 {totalCompletedLessons} / {totalCourseLessons} 个课时
                  </p>
                </div>

                <p className="text-2xl font-black tracking-tight text-gray-900">
                  {overallCourseProgressPercent}%
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{ width: `${overallCourseProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 课程列表板块 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                课程列表
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                当前分类下共有 {courses.length} 门课程。
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {courses.length} 门课程
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
                  totalLessons === 0
                    ? "查看课程"
                    : isCompleted
                      ? "复习课程"
                      : isInProgress
                        ? "继续学习"
                        : "开始学习";


                const levelLabel = getCourseLevelLabel(course.level);

                return (
                  <article
                    key={course.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px_150px] lg:items-center">
                      {/* 左侧：课程信息 */}
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${color.iconBox}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2
                              className="text-green-600"
                              size={28}
                            />
                          ) : (
                            <GraduationCap
                              className={color.iconText}
                              size={28}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                            >
                              {subcategory.title}
                            </span>

                            {levelLabel && (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                {levelLabel}
                              </span>
                            )}

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isCompleted
                                  ? "bg-green-50 text-green-600"
                                  : isInProgress
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {isCompleted
                                ? "已完成"
                                : isInProgress
                                  ? "进行中"
                                  : "未开始"}
                            </span>
                          </div>

                          <h3 className="text-lg font-black tracking-tight text-gray-900">
                            {course.title}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                            {course.description || "暂无课程简介"}
                          </p>
                        </div>
                      </div>

                      {/* 中间：学习进度 */}
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <Clock size={13} />
                            共 {totalLessons} 个课时
                          </div>

                          <span className="text-sm font-black text-gray-900">
                            {courseProgressPercent}%
                          </span>
                        </div>

                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
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

                        <div className="h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCompleted ? "bg-green-500" : color.progress
                            }`}
                            style={{ width: `${courseProgressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* 右侧：按钮 */}
                      <Link
                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition lg:w-auto ${
                          isCompleted
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : isInProgress
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-gray-900 text-white hover:bg-gray-800"
                        }`}
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
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="font-semibold text-gray-900">暂无课程</p>
              <p className="mt-2 text-sm text-gray-500">
                当前分类下还没有发布课程。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}