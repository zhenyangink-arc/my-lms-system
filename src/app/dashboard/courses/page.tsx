import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Languages,
  LoaderCircle,
  PlayCircle,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type LearningStatus = "not_started" | "in_progress" | "completed";

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  sort_order: number;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
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

const categoryIconMap: Record<string, LucideIcon> = {
  service: FileCheck2,
  korean: Languages,
  english: BookOpen,
  math: Calculator,
  university: GraduationCap,
};

const learningStatusLabelMap: Record<LearningStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
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

function resolveLearningStatus({
  totalLessons,
  completedLessons,
  inProgressLessons,
}: {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
}): LearningStatus {
  if (totalLessons > 0 && completedLessons === totalLessons) {
    return "completed";
  }

  if (completedLessons > 0 || inProgressLessons > 0) {
    return "in_progress";
  }

  return "not_started";
}

export default async function CoursesPage() {
  const { supabase, user, platformProfile } = await requireActiveUser();
  const isPlatformAudit = platformProfile?.role === "platform_super_admin";

  /**
   * 1. 一级课程板块
   */
  const { data: categoryData } = await supabase
    .from("course_categories")
    .select(
      "id, parent_id, slug, title, description, icon_name, accent_color, sort_order"
    )
    .is("parent_id", null)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const categories = (categoryData ?? []) as CourseCategory[];

  const categoryIds = categories.map((category) => category.id);

  /**
   * 2. 二级分类
   */
  let subcategories: CourseCategory[] = [];

  if (categoryIds.length > 0) {
    const { data: subcategoryData } = await supabase
      .from("course_categories")
      .select(
        "id, parent_id, slug, title, description, icon_name, accent_color, sort_order"
      )
      .in("parent_id", categoryIds)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    subcategories = (subcategoryData ?? []) as CourseCategory[];
  }

  const subcategoryIds = subcategories.map((subcategory) => subcategory.id);

  /**
   * 3. 具体课程
   */
  let courses: Course[] = [];

  if (subcategoryIds.length > 0) {
    const { data: courseData } = await supabase
      .from("courses")
      .select("id, category_id, slug, title, description")
      .in("category_id", subcategoryIds)
      .eq("is_published", true);

    courses = (courseData ?? []) as Course[];
  }

  const courseIds = courses.map((course) => course.id);

  /**
   * 4. 课时
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
   * 5. 当前用户学习进度
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
   * 6. 整理 Map
   */
  const subcategoriesByParentId = new Map<string, CourseCategory[]>();

  subcategories.forEach((subcategory) => {
    if (!subcategory.parent_id) {
      return;
    }

    const currentSubcategories =
      subcategoriesByParentId.get(subcategory.parent_id) ?? [];

    currentSubcategories.push(subcategory);
    subcategoriesByParentId.set(subcategory.parent_id, currentSubcategories);
  });

  const coursesBySubcategoryId = new Map<string, Course[]>();

  courses.forEach((course) => {
    if (!course.category_id) {
      return;
    }

    const currentCourses = coursesBySubcategoryId.get(course.category_id) ?? [];
    currentCourses.push(course);
    coursesBySubcategoryId.set(course.category_id, currentCourses);
  });

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

  return (
    <div className="space-y-5 p-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-gray-900">
              课程板块
            </h2>
          </div>

            <BookOpen className="text-gray-300" size={30} />
          </div>

          {categories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const categorySubcategories =
                  subcategoriesByParentId.get(category.id) ?? [];

                const categorySubcategoryIds = new Set(
                  categorySubcategories.map((subcategory) => subcategory.id)
                );

                const categoryCourses = courses.filter((course) => {
                  if (!course.category_id) {
                    return false;
                  }

                  return categorySubcategoryIds.has(course.category_id);
                });

                const categoryCourseIds = new Set(
                  categoryCourses.map((course) => course.id)
                );

                const categoryLessons = lessons.filter((lesson) =>
                  categoryCourseIds.has(lesson.course_id)
                );

                const totalSubcategories = categorySubcategories.length;
                const totalCourses = categoryCourses.length;
                const totalLessons = categoryLessons.length;

                const completedLessons = categoryLessons.filter((lesson) => {
                  const progress = progressMap.get(lesson.id);
                  return progress?.status === "completed";
                }).length;

                const inProgressLessons = categoryLessons.filter((lesson) => {
                  const progress = progressMap.get(lesson.id);
                  return progress?.status === "in_progress";
                }).length;

                const progressPercent =
                  totalLessons > 0
                    ? Math.round((completedLessons / totalLessons) * 100)
                    : 0;

                const learningStatus = resolveLearningStatus({
                  totalLessons,
                  completedLessons,
                  inProgressLessons,
                });

                const learningStatusLabel =
                  learningStatusLabelMap[learningStatus];

                const isCompleted = learningStatus === "completed";
                const isInProgress = learningStatus === "in_progress";

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

                const color =
                  colorMap[category.accent_color ?? "indigo"] ??
                  colorMap.indigo;

                const CategoryIcon =
                  categoryIconMap[category.slug] ?? BookOpen;

                const isFocusCategory =
                  category.slug === "service" || category.slug === "korean";

                // 只为留学服务课和韩语课程启用新版布局，其他课程保持原样。
                if (isFocusCategory) {
                  const isServiceCourse = category.slug === "service";
                  const accent = isServiceCourse
                    ? "var(--app-accent)"
                    : "var(--app-secondary)";
                  const accentSoft = isServiceCourse
                    ? "var(--app-accent-soft)"
                    : "var(--app-secondary-soft)";

                  return (
                    <article
                      key={category.id}
                      className="app-card relative overflow-hidden rounded-3xl border p-5 transition hover:-translate-y-1"
                      style={{
                        background: isServiceCourse
                          ? "linear-gradient(145deg, var(--app-card-bg), var(--app-hero-start))"
                          : "linear-gradient(145deg, var(--app-card-bg), var(--app-hero-end))",
                      }}
                    >
                      <div
                        className="absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-60 blur-3xl"
                        style={{ backgroundColor: accentSoft }}
                      />
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <span
                            className="flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{ color: accent, backgroundColor: accentSoft }}
                          >
                            {isCompleted ? (
                              <CheckCircle2 size={27} aria-hidden="true" />
                            ) : (
                              <CategoryIcon size={27} aria-hidden="true" />
                            )}
                          </span>
                          <span
                            className="rounded-full px-3 py-1.5 text-xs font-black"
                            style={{ color: accent, backgroundColor: accentSoft }}
                          >
                            {isServiceCourse ? "留学规划主线" : "韩语成长主线"}
                          </span>
                        </div>

                        <h3 className="mt-5 text-xl font-black tracking-tight">
                          {category.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 app-muted-text">
                          {category.description ||
                            (isServiceCourse
                              ? "从选校、材料到签证，按阶段推进韩国留学准备。"
                              : "围绕听、说、读、写建立可持续的韩语成长路线。")}
                        </p>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          {[
                            ["分类", totalSubcategories],
                            ["课程", totalCourses],
                            ["课时", totalLessons],
                          ].map(([label, value]) => (
                            <div key={label} className="app-tile rounded-2xl border p-3 text-center">
                              <p className="text-lg font-black">{value}</p>
                              <p className="mt-0.5 text-xs font-bold app-muted-text">{label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold app-muted-text">{learningStatusLabel}</span>
                            <strong style={{ color: "var(--app-success)" }}>{progressPercent}%</strong>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progressPercent}%`,
                                backgroundColor: "var(--app-success)",
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs app-muted-text">
                            已完成 {completedLessons} / {totalLessons} 个课时
                          </p>
                        </div>

                        <Link
                          href={`/dashboard/courses/${category.slug}`}
                          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white shadow-sm transition hover:opacity-90"
                          style={{ backgroundColor: accent }}
                        >
                          <PlayCircle size={17} aria-hidden="true" />
                          {buttonLabel}
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    key={category.id}
                    className="flex h-full flex-col rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${color.iconBox}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="text-green-600" size={25} />
                        ) : (
                          <CategoryIcon className={color.iconText} size={25} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                          >
                            {category.title}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            <LoaderCircle size={13} />
                            努力完善中
                          </span>
                        </div>

                        <h3 className="line-clamp-1 text-base font-black tracking-tight text-gray-900">
                          {category.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                          {category.description || "暂无课程板块简介"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isCompleted
                              ? "bg-green-50 text-green-700"
                              : isInProgress
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {learningStatusLabel}
                        </span>

                        <span className="text-xl font-black text-gray-900">
                          {progressPercent}%
                        </span>
                      </div>

                      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                        <span>
                          已完成 {completedLessons} / {totalLessons} 个课时
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCompleted ? "bg-green-500" : color.progress
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      <p className="mt-3 text-xs text-gray-400">
                        {totalSubcategories} 个分类 · {totalCourses} 门课程 ·{" "}
                        {totalLessons} 个课时
                      </p>
                    </div>

                    {/* 英语、数学与大学课程暂不开放入口，避免没有资源时造成误导。 */}
                    <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                      <LoaderCircle size={16} />
                      努力完善中
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="font-semibold text-gray-900">暂无课程板块</p>
              <p className="mt-2 text-sm text-gray-500">
                当前还没有发布课程板块。
              </p>
            </div>
          )}
        </section>
      </div>
  );
}
