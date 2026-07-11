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

import { createClient } from "@/lib/supabase/server";
import { DashboardPageHeader } from "../../../../DashboardPageHeader";
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
    progress: "bg-orange-600",
  },
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let progressList: LessonProgress[] = [];

  if (user && lessons.length > 0) {
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



  const color =
    colorMap[subcategory.accent_color ?? "indigo"] ?? colorMap.indigo;

  return (
    <>
      <DashboardPageHeader
        title={course.title}
        description={course.description || "查看课程介绍和课时学习进度。"}
      />

      <div className="space-y-6 p-6">
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
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
            <div className="flex gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${color.iconBox}`}
              >
                <GraduationCap className={color.iconText} size={32} />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                  >
                    {subcategory.title}
                  </span>

                  {course.level && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                      {getCourseLevelLabel(course.level)}
                    </span>
                  )}

                  <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
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

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">课程进度</p>

                  <p className="mt-1 text-xs text-gray-500">
                    已完成 {completedCount} / {totalLessons} 个课时
                  </p>
                </div>

                <p className="text-2xl font-black tracking-tight text-gray-900">
                  {courseProgressPercent}%
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{ width: `${courseProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 课时列表 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                课时列表
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                按顺序完成课时，系统会自动记录学习状态。
              </p>
            </div>

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

                return (
                  <div
                    key={lesson.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${isCompleted
                            ? "bg-green-50 text-green-600"
                            : isInProgress
                              ? "bg-blue-50 text-blue-600"
                              : "bg-gray-100 text-gray-500"
                            }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={21} />
                          ) : (
                            String(index + 1).padStart(2, "0")
                          )}
                        </div>

                        <div>
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                              {lessonTypeLabel}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                              <Clock size={13} />
                              {lesson.duration_minutes} 分钟
                            </span>

                            {lesson.is_free_preview && (
                              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                                可试看
                              </span>
                            )}

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${isCompleted
                                ? "bg-green-50 text-green-600"
                                : isInProgress
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-gray-100 text-gray-600"
                                }`}
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
                          <span>学习进度</span>
                          <span>{progressPercent}%</span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${isCompleted ? "bg-green-500" : "bg-gray-900"
                              }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        <Link
                          href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`}
                          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isCompleted
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : isInProgress
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-gray-900 text-white hover:bg-gray-800"
                            }`}
                        >
                          <PlayCircle size={15} />
                          {isCompleted
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
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
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