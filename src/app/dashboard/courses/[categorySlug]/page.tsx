import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck2,
  FolderOpen,
  Languages,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";


export const runtime = "edge";
type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type LearningStatus = "not_started" | "in_progress" | "completed";

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  accent_color: string | null;
  sort_order: number;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
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

export default async function CategoryPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
  }>;
}) {
  const { categorySlug } = await params;

  const { supabase, user, platformProfile } = await requireActiveUser();
  const isPlatformAudit = platformProfile?.role === "platform_super_admin";

  /**
   * 1. 查询一级课程板块
   */
  const { data: parentCategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, accent_color, sort_order")
    .eq("slug", categorySlug)
    .is("parent_id", null)
    .eq("is_published", true)
    .maybeSingle();

  if (!parentCategoryData) {
    notFound();
  }

  const parentCategory = parentCategoryData as CourseCategory;

  /**
   * 2. 查询当前一级板块下的二级分类
   */
  const { data: subcategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, accent_color, sort_order")
    .eq("parent_id", parentCategory.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const subcategories = (subcategoryData ?? []) as CourseCategory[];

  const subcategoryIds = subcategories.map((subcategory) => subcategory.id);

  /**
   * 3. 查询这些二级分类下面的课程
   */
  let courses: Course[] = [];

  if (subcategoryIds.length > 0) {
    const { data: courseData } = await supabase
      .from("courses")
      .select("id, category_id, slug, title, description, sort_order")
      .in("category_id", subcategoryIds)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    courses = (courseData ?? []) as Course[];
  }

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
   * 6. 整理 Map，方便按二级分类统计
   */
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

  const color =
    colorMap[parentCategory.accent_color ?? "indigo"] ?? colorMap.indigo;

  const temporaryAccessStatus = {
    label: "已开通",
    enabled: true,
  };
  const totalParentLessons = lessons.length;

  const totalParentCompletedLessons = lessons.filter((lesson) => {
    const progress = progressMap.get(lesson.id);
    return progress?.status === "completed";
  }).length;

  const parentProgressPercent =
    totalParentLessons > 0
      ? Math.round((totalParentCompletedLessons / totalParentLessons) * 100)
      : 0;

  const isFocusCategory =
    parentCategory.slug === "service" || parentCategory.slug === "korean";

  if (isFocusCategory) {
    const isServiceCourse = parentCategory.slug === "service";
    const FocusIcon = isServiceCourse ? FileCheck2 : Languages;
    const accent = isServiceCourse
      ? "var(--app-accent)"
      : "var(--app-secondary)";
    const accentSoft = isServiceCourse
      ? "var(--app-accent-soft)"
      : "var(--app-secondary-soft)";

    return (
      <>
        <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-2 text-sm font-bold app-muted-text transition hover:opacity-75"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回我的课程
          </Link>

          <section
            className="app-card relative overflow-hidden rounded-3xl border p-5 sm:p-6"
            style={{
              background: isServiceCourse
                ? "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg) 58%, var(--app-accent-soft))"
                : "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg) 58%, var(--app-secondary-soft))",
            }}
          >
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_320px]">
              <div>
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                  style={{ color: accent, backgroundColor: accentSoft }}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  {isServiceCourse ? "韩国留学规划路线" : "韩语能力成长路线"}
                </span>
                <div className="mt-5 flex items-start gap-4">
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl"
                    style={{ color: accent, backgroundColor: accentSoft }}
                  >
                    <FocusIcon size={30} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">
                      {isServiceCourse ? "一步一步完成留学准备" : "建立可持续的韩语学习节奏"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 app-muted-text">
                      {isServiceCourse
                        ? "从目标确认到材料、面试和签证，每个分类都是留学申请中的一个真实阶段。"
                        : "根据课程分类选择当前最需要加强的能力，并用课时进度记录每一次成长。"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="app-card rounded-3xl border p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold app-muted-text">板块总进度</p>
                    <p className="mt-1 text-2xl font-black">{parentProgressPercent}%</p>
                  </div>
                  <span className="text-xs font-bold app-muted-text">
                    {totalParentCompletedLessons}/{totalParentLessons} 课时
                  </span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${parentProgressPercent}%`,
                      backgroundColor: "var(--app-success)",
                    }}
                  />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="app-tile rounded-2xl border p-3 text-center">
                    <p className="text-xl font-black">{subcategories.length}</p>
                    <p className="text-xs font-bold app-muted-text">课程分类</p>
                  </div>
                  <div className="app-tile rounded-2xl border p-3 text-center">
                    <p className="text-xl font-black">{courses.length}</p>
                    <p className="text-xs font-bold app-muted-text">可学课程</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black">选择学习阶段</h3>
            </div>
            {subcategories.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {subcategories.map((subcategory, index) => {
                  const subcategoryCourses = coursesBySubcategoryId.get(subcategory.id) ?? [];
                  const courseIdSet = new Set(subcategoryCourses.map((course) => course.id));
                  const subcategoryLessons = lessons.filter((lesson) => courseIdSet.has(lesson.course_id));
                  const completedLessons = subcategoryLessons.filter(
                    (lesson) => progressMap.get(lesson.id)?.status === "completed"
                  ).length;
                  const inProgressLessons = subcategoryLessons.filter(
                    (lesson) => progressMap.get(lesson.id)?.status === "in_progress"
                  ).length;
                  const progressPercent = subcategoryLessons.length > 0
                    ? Math.round((completedLessons / subcategoryLessons.length) * 100)
                    : 0;
                  const learningStatus = resolveLearningStatus({
                    totalLessons: subcategoryLessons.length,
                    completedLessons,
                    inProgressLessons,
                  });

                  return (
                    <Link
                      key={subcategory.id}
                      href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`}
                      className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1"
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                          style={{ color: accent, backgroundColor: accentSoft }}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-black">{subcategory.title}</h4>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 app-muted-text">
                                {subcategory.description || "查看这一阶段的课程内容。"}
                              </p>
                            </div>
                            <ArrowRight size={17} className="shrink-0 app-muted-text transition group-hover:translate-x-1" aria-hidden="true" />
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold app-muted-text">
                            <span>{subcategoryCourses.length} 门课程 · {subcategoryLessons.length} 个课时</span>
                            <span style={{ color: accent }}>{isPlatformAudit ? "只读巡检" : learningStatusLabelMap[learningStatus]}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                            <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: "var(--app-success)" }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="app-empty-state rounded-3xl p-6 text-center text-sm app-muted-text">
                当前还没有发布课程分类。
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-5 p-5">
        {/* 返回路径 */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回我的课程
          </Link>
        </div>

        {/* 页面说明板块 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                >
                  {parentCategory.title}
                </span>

                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {temporaryAccessStatus.label}
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                选择课程分类
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                每个分类会显示当前账号的整体学习状态。你可以从这里进入申请、签证、面试等不同课程模块。
              </p>
            </div>

            {/* 右侧：当前板块整体进度 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">课程进度</p>

                  <p className="mt-1 text-xs text-gray-500">
                    已完成 {totalParentCompletedLessons} / {totalParentLessons} 个课时
                  </p>
                </div>

                <p className="text-2xl font-black tracking-tight text-gray-900">
                  {parentProgressPercent}%
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{ width: `${parentProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 二级分类列表 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                课程分类
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                当前板块下共有 {subcategories.length} 个课程分类。
              </p>
            </div>

            <BookOpen className="text-gray-300" size={30} />
          </div>

          {subcategories.length > 0 ? (
            <div className="space-y-4">
              {subcategories.map((subcategory) => {
                const subcategoryCourses =
                  coursesBySubcategoryId.get(subcategory.id) ?? [];

                const subcategoryCourseIds = new Set(
                  subcategoryCourses.map((course) => course.id)
                );

                const subcategoryLessons = lessons.filter((lesson) =>
                  subcategoryCourseIds.has(lesson.course_id)
                );

                const totalCourses = subcategoryCourses.length;
                const totalLessons = subcategoryLessons.length;

                const completedLessons = subcategoryLessons.filter((lesson) => {
                  const progress = progressMap.get(lesson.id);
                  return progress?.status === "completed";
                }).length;

                const inProgressLessons = subcategoryLessons.filter(
                  (lesson) => {
                    const progress = progressMap.get(lesson.id);
                    return progress?.status === "in_progress";
                  }
                ).length;

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

                const cardColor =
                  colorMap[subcategory.accent_color ?? parentCategory.accent_color ?? "indigo"] ??
                  color;
                

                return (
                  <article
                    key={subcategory.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px_150px] lg:items-center">
                      {/* 左侧：分类信息 */}
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${cardColor.iconBox}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2
                              className="text-green-600"
                              size={28}
                            />
                          ) : (
                            <FolderOpen
                              className={cardColor.iconText}
                              size={28}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${cardColor.badge}`}
                            >
                              {subcategory.title}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                              <ShieldCheck size={13} />
                              {temporaryAccessStatus.label}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${isCompleted
                                ? "bg-green-50 text-green-700"
                                : isInProgress
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                                }`}
                            >
                              {learningStatusLabel}
                            </span>
                          </div>

                          <h4 className="text-lg font-black tracking-tight text-gray-900">
                            {subcategory.title}
                          </h4>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                            {subcategory.description || "暂无分类简介"}
                          </p>
                        </div>
                      </div>

                      {/* 中间：学习进度 */}
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <Clock size={13} />
                            {totalCourses} 门课程 · {totalLessons} 个课时
                          </div>

                          <span className="text-xl font-black text-gray-900">
                            {progressPercent}%
                          </span>
                        </div>

                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                          <span>
                            已完成 {completedLessons} / {totalLessons} 个课时
                          </span>

                          <span>{learningStatusLabel}</span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full transition-all ${isCompleted ? "bg-green-500" : cardColor.progress
                              }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* 右侧：按钮 */}
                      <Link
                        href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition lg:w-auto ${isCompleted
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
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="font-semibold text-gray-900">暂无课程分类</p>
              <p className="mt-2 text-sm text-gray-500">
                当前课程板块下还没有发布二级分类。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
