import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  GraduationCap,
  Heart,
  Languages,
  LoaderCircle,
  PlayCircle,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { requireActiveUser } from "@/lib/auth";
import { isPlatformCourseAuditorRole } from "@/lib/admin";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import {
  STUDENT_APP_IDS,
  getStudentAppCoursesPath,
  getStudentAppPath,
  type StudentAppSlug,
} from "@/lib/student-apps";
import {
  addCourseCategoryToFavoritesAction,
  removeCourseCategoryFromFavoritesAction,
} from "./actions";
import {
  KoreanCourseCatalogBrowser,
  type KoreanCourseCatalogSection,
  type KoreanCourseLearningStatus,
} from "./KoreanCourseCatalogBrowser";


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
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  sort_order: number;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
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

function KoreanDirectCourseCatalog({
  space,
  subcategories,
  courses,
  lessons,
  progressMap,
  isPlatformAudit,
  dataError,
}: {
  space: string;
  subcategories: CourseCategory[];
  courses: Course[];
  lessons: Lesson[];
  progressMap: Map<string, LessonProgress>;
  isPlatformAudit: boolean;
  dataError: boolean;
}) {
  const subcategoryMap = new Map(
    subcategories.map((subcategory) => [subcategory.id, subcategory]),
  );
  const visibleCourses = courses.filter(
    (course) => course.category_id && subcategoryMap.has(course.category_id),
  );
  const lessonsByCourseId = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const courseLessons = lessonsByCourseId.get(lesson.course_id) ?? [];
    courseLessons.push(lesson);
    lessonsByCourseId.set(lesson.course_id, courseLessons);
  });

  const courseSections: KoreanCourseCatalogSection[] = subcategories.map(
    (subcategory) => {
      const categoryCourses = visibleCourses.filter(
        (course) => course.category_id === subcategory.id,
      );
      const catalogCourses = categoryCourses.map((course, index) => {
        const courseLessons = lessonsByCourseId.get(course.id) ?? [];
        const totalLessons = courseLessons.length;
        const completedLessons = courseLessons.filter(
          (lesson) => progressMap.get(lesson.id)?.status === "completed",
        ).length;
        const inProgressLessons = courseLessons.filter(
          (lesson) => progressMap.get(lesson.id)?.status === "in_progress",
        ).length;
        const progressTotal = courseLessons.reduce((total, lesson) => {
          const progress = progressMap.get(lesson.id);
          if (progress?.status === "completed") return total + 100;
          if (progress?.status === "in_progress") {
            return (
              total +
              Math.min(100, Math.max(0, progress.progress_percent))
            );
          }
          return total;
        }, 0);
        const progressPercent =
          totalLessons > 0 ? Math.round(progressTotal / totalLessons) : 0;
        const learningStatus: KoreanCourseLearningStatus =
          totalLessons === 0
            ? "preparing"
            : resolveLearningStatus({
                totalLessons,
                completedLessons,
                inProgressLessons,
              });

        return {
          id: course.id,
          sequence: index + 1,
          title: course.title,
          description: course.description,
          level: course.level,
          coverObjectKey: course.cover_object_key,
          coverAlt: course.cover_alt,
          coverFocalPoint: course.cover_focal_point,
          totalLessons,
          completedLessons,
          progressPercent,
          learningStatus,
          href:
            getStudentAppPath(space, "korean", "courses/korean") +
            `?course=${encodeURIComponent(course.slug)}`,
        };
      });

      return {
        id: subcategory.id,
        slug: subcategory.slug,
        title: subcategory.title,
        description: subcategory.description,
        coverObjectKey: subcategory.cover_object_key,
        coverAlt: subcategory.cover_alt,
        coverFocalPoint: subcategory.cover_focal_point,
        lessonCount: catalogCourses.reduce(
          (total, course) => total + course.totalLessons,
          0,
        ),
        courses: catalogCourses,
      };
    },
  );
  const totalCompletedLessons = courseSections.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      section.courses.reduce(
        (courseTotal, course) => courseTotal + course.completedLessons,
        0,
      ),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header
        className="app-card relative overflow-hidden rounded-3xl border p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, var(--card) 0%, var(--accent) 100%)",
        }}
      >
        <span
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--support-surface)] opacity-60 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2
              id="korean-course-catalog-title"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            >
              所有韩语课程，一页看清
            </h2>
            <p className="app-muted-text mt-3 max-w-2xl text-sm font-medium leading-7 sm:text-base">
              从基础能力到真实生活，再到 TOPIK 备考。课程已按教学顺序编号，也可以按自己的节奏选择。
            </p>
          </div>

          {!dataError && <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="app-card min-w-0 rounded-2xl border px-3 py-3 text-center sm:min-w-24 sm:px-4">
              <dt className="app-muted-text text-xs font-semibold">学习方向</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {courseSections.length}
              </dd>
            </div>
            <div className="app-card min-w-0 rounded-2xl border px-3 py-3 text-center sm:min-w-24 sm:px-4">
              <dt className="app-muted-text text-xs font-semibold">课程</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {visibleCourses.length}
              </dd>
            </div>
            <div className="app-card min-w-0 rounded-2xl border px-3 py-3 text-center sm:min-w-28 sm:px-4">
              <dt className="app-muted-text text-xs font-semibold">
                {isPlatformAudit ? "已发布课时" : "我的进度"}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">
                {isPlatformAudit ? (
                  lessons.length
                ) : (
                  <>
                    {totalCompletedLessons}
                    <span className="app-muted-text text-sm font-semibold">
                      {" "}/ {lessons.length}
                    </span>
                  </>
                )}
              </dd>
            </div>
          </dl>}
        </div>
      </header>

      {dataError ? (
        <section
          role="alert"
          className="rounded-2xl border border-[var(--status-warning)] bg-[var(--status-warning-surface)] p-4 text-sm font-semibold text-[var(--status-warning)]"
        >
          韩语课程暂时无法读取，请稍后刷新页面重试。
        </section>
      ) : (
        <KoreanCourseCatalogBrowser sections={courseSections} />
      )}
    </div>
  );
}

export async function CourseCatalog({
  studentAppSlug,
  space,
}: {
  studentAppSlug?: StudentAppSlug;
  space?: string;
}) {
  const { supabase, user, platformProfile } = await requireActiveUser();
  const courseBasePath =
    studentAppSlug && space
      ? getStudentAppCoursesPath(space, studentAppSlug)
      : null;
  const isPlatformAudit = isPlatformCourseAuditorRole(platformProfile?.role);
  let catalogReadError = false;

  /**
   * 1. 一级课程板块
   */
  let categoryData: unknown[] | null = null;
  if (studentAppSlug) {
    const categorySlug =
      studentAppSlug === "study-abroad" ? "service" : studentAppSlug;
    const result = await withStudentAppSchemaFallback(
      supabase
        .from("course_categories")
        .select(
          "id, parent_id, slug, title, description, icon_name, accent_color, cover_object_key, cover_alt, cover_focal_point, sort_order"
        )
        .is("parent_id", null)
        .eq("student_app_id", STUDENT_APP_IDS[studentAppSlug])
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      () =>
        supabase
          .from("course_categories")
          .select(
            "id, parent_id, slug, title, description, icon_name, accent_color, cover_object_key, cover_alt, cover_focal_point, sort_order"
          )
          .is("parent_id", null)
          .eq("slug", categorySlug)
          .eq("is_published", true)
          .order("sort_order", { ascending: true }),
    );
    categoryData = result.data;
    catalogReadError = Boolean(result.error);
  } else {
    const result = await supabase
      .from("course_categories")
      .select(
        "id, parent_id, slug, title, description, icon_name, accent_color, cover_object_key, cover_alt, cover_focal_point, sort_order"
      )
      .is("parent_id", null)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    categoryData = result.data;
    catalogReadError = Boolean(result.error);
  }

  const categories = (categoryData ?? []) as CourseCategory[];

  const categoryIds = categories.map((category) => category.id);

  /**
   * 2. 二级分类
   */
  let subcategories: CourseCategory[] = [];

  if (categoryIds.length > 0) {
    let subcategoryQuery = supabase
      .from("course_categories")
      .select(
        "id, parent_id, slug, title, description, icon_name, accent_color, cover_object_key, cover_alt, cover_focal_point, sort_order"
      )
      .in("parent_id", categoryIds)
      .eq("is_published", true);

    if (studentAppSlug) {
      subcategoryQuery = subcategoryQuery.eq(
        "student_app_id",
        STUDENT_APP_IDS[studentAppSlug],
      );
    }

    const { data: subcategoryData, error: subcategoryError } = await subcategoryQuery
      .order("sort_order", { ascending: true });

    subcategories = (subcategoryData ?? []) as CourseCategory[];
    catalogReadError ||= Boolean(subcategoryError);
  }

  const subcategoryIds = subcategories.map((subcategory) => subcategory.id);

  /**
   * 3. 具体课程
   */
  let courses: Course[] = [];

  if (subcategoryIds.length > 0) {
    let courseQuery = supabase
      .from("courses")
      .select("id, category_id, slug, title, description, level, cover_object_key, cover_alt, cover_focal_point, sort_order")
      .in("category_id", subcategoryIds)
      .eq("is_published", true);

    if (studentAppSlug) {
      courseQuery = courseQuery.eq(
        "student_app_id",
        STUDENT_APP_IDS[studentAppSlug],
      );
    }

    const { data: courseData, error: courseError } = await courseQuery
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    courses = (courseData ?? []) as Course[];
    catalogReadError ||= Boolean(courseError);
  }

  const courseIds = courses.map((course) => course.id);

  /**
   * 4. 课时
   */
  let lessons: Lesson[] = [];

  if (courseIds.length > 0) {
    const { data: lessonData, error: lessonError } = await supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds)
      .eq("is_published", true);

    lessons = (lessonData ?? []) as Lesson[];
    catalogReadError ||= Boolean(lessonError);
  }

  const lessonIds = lessons.map((lesson) => lesson.id);

  /**
   * 5. 当前用户学习进度
   */
  let progressList: LessonProgress[] = [];

  if (!isPlatformAudit && user && lessonIds.length > 0) {
    const { data: progressData, error: progressError } = await supabase
      .from("lesson_progress")
      .select("lesson_id, status, progress_percent")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);

    progressList = (progressData ?? []).map((item) => ({
      lesson_id: item.lesson_id,
      status: resolveProgressStatus(item.status),
      progress_percent: item.progress_percent ?? 0,
    }));
    catalogReadError ||= Boolean(progressError);
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

  const progressMap = new Map<string, LessonProgress>();

  progressList.forEach((progress) => {
    progressMap.set(progress.lesson_id, progress);
  });

  if (studentAppSlug === "korean" && space) {
    return (
      <KoreanDirectCourseCatalog
        space={space}
        subcategories={subcategories}
        courses={courses}
        lessons={lessons}
        progressMap={progressMap}
        isPlatformAudit={isPlatformAudit}
        dataError={catalogReadError}
      />
    );
  }

  const { data: favoriteCategoryRows } = !isPlatformAudit
    ? await supabase
        .from("student_course_category_favorites")
        .select("category_id")
        .eq("user_id", user.id)
    : { data: [] as { category_id: string }[] };

  const favoriteCategoryIds = new Set(
    (favoriteCategoryRows ?? []).map((row) => row.category_id)
  );
  const upcomingCategorySlugs = new Set(["english", "math", "university"]);
  const upcomingCategories = categories.filter((category) =>
    upcomingCategorySlugs.has(category.slug)
  );
  const availableCategories = categories.filter(
    (category) =>
      !upcomingCategorySlugs.has(category.slug) &&
      !favoriteCategoryIds.has(category.id)
  );
  const favoriteCategories = categories.filter(
    (category) =>
      !upcomingCategorySlugs.has(category.slug) &&
      favoriteCategoryIds.has(category.id)
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="space-y-5">
          {categories.length > 0 ? (
            <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,0.85fr)] lg:items-start">
            <div className="grid gap-4 md:grid-cols-2">
              {availableCategories.map((category) => {
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
                  totalLessons === 0
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
                    ? "var(--primary)"
                    : "var(--support)";
                  const accentSoft = isServiceCourse
                    ? "var(--accent)"
                    : "var(--support-surface)";

                  return (
                    <article
                      key={category.id}
                      className="app-card relative overflow-hidden rounded-3xl border p-5 transition hover:-translate-y-1"
                      style={{
                        background: isServiceCourse
                          ? "linear-gradient(145deg, var(--card), var(--card))"
                          : "linear-gradient(145deg, var(--card), var(--accent))",
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
                            className="rounded-full px-3 py-1.5 text-xs font-bold"
                            style={{ color: accent, backgroundColor: accentSoft }}
                          >
                            {isServiceCourse ? "留学规划主线" : "韩语成长主线"}
                          </span>
                        </div>

                        <DashboardTitleWithHint
                          className="mt-5"
                          headingLevel={3}
                          titleClassName="text-xl font-bold tracking-tight"
                          title={category.title}
                          description={
                            category.description ||
                            (isServiceCourse
                              ? "从选校、材料到签证，按阶段推进韩国留学准备。"
                              : "围绕听、说、读、写建立可持续的韩语成长路线。")
                          }
                        />

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          {[
                            ["分类", totalSubcategories],
                            ["课程", totalCourses],
                            ["课时", totalLessons],
                          ].map(([label, value]) => (
                            <div key={label} className="app-tile rounded-2xl border p-3 text-center">
                              <p className="text-lg font-bold">{value}</p>
                              <p className="mt-0.5 text-xs font-bold app-muted-text">{label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold app-muted-text">{learningStatusLabel}</span>
                            <strong style={{ color: "var(--status-success)" }}>{progressPercent}%</strong>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progressPercent}%`,
                                backgroundColor: "var(--status-success)",
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs app-muted-text">
                            已完成 {completedLessons} / {totalLessons} 个课时
                          </p>
                        </div>

                        <Link
                          href={courseBasePath ? `${courseBasePath}/${category.slug}` : "/"}
                          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
                          style={{ backgroundColor: accent }}
                        >
                          <PlayCircle size={17} aria-hidden="true" />
                          {buttonLabel}
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                        {!isPlatformAudit && (
                          <form
                            action={addCourseCategoryToFavoritesAction}
                            data-permission="dashboard_section"
                          >
                            <input type="hidden" name="categoryId" value={category.id} />
                            <button
                              type="submit"
                              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition hover:bg-black/[0.02]"
                              style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
                            >
                              <Heart size={14} aria-hidden="true" />
                              移入收藏夹
                            </button>
                          </form>
                        )}
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

                        <DashboardTitleWithHint
                          headingLevel={3}
                          titleClassName="line-clamp-1 text-base font-bold tracking-tight text-gray-900"
                          title={category.title}
                          description={category.description || "暂无课程板块简介"}
                        />
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

                        <span className="text-xl font-bold text-gray-900">
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
              {availableCategories.length === 0 && (
                <div className="app-empty-state flex min-h-52 flex-col items-center justify-center rounded-3xl p-6 text-center md:col-span-2">
                  <BookOpen size={26} style={{ color: "var(--support)" }} aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold">暂无可学课程</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
            <details className="app-soft-card group rounded-3xl border p-4 sm:p-5" aria-label="收藏夹">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] [&::-webkit-details-marker]:hidden">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                  style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}
                >
                  <Heart size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold">收藏夹</h2>
                  <p className="mt-0.5 text-xs app-muted-text">暂时不学的课程可以收纳在这里，之后随时恢复。</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--card)" }}>{favoriteCategories.length}</span>
                <ChevronDown size={17} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              {favoriteCategories.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {favoriteCategories.map((category) => {
                    const CategoryIcon = categoryIconMap[category.slug] ?? BookOpen;
                    return (
                      <div key={category.id} className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                        <CategoryIcon size={17} className="shrink-0 app-muted-text" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{category.title}</span>
                        {isPlatformAudit ? (
                          <span className="shrink-0 text-[10px] font-bold app-muted-text">仅查看</span>
                        ) : (
                          <form
                            action={removeCourseCategoryFromFavoritesAction}
                            data-permission="dashboard_section"
                          >
                            <input type="hidden" name="categoryId" value={category.id} />
                            <button type="submit" className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                              移出收藏夹
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed p-4 text-center text-xs app-muted-text" style={{ borderColor: "var(--border)" }}>
                  收藏夹还是空的
                </p>
              )}
            </details>
            <details className="app-soft-card group rounded-3xl border p-4 sm:p-5" aria-label="即将开放的课程">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] [&::-webkit-details-marker]:hidden">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"
                >
                  <LoaderCircle size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold">即将开放的课程</h2>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--card)" }}>{upcomingCategories.length}</span>
                <ChevronDown size={17} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              {upcomingCategories.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {upcomingCategories.map((category) => {
                    const CategoryIcon = categoryIconMap[category.slug] ?? BookOpen;
                    return (
                      <div key={category.id} className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                        <CategoryIcon size={17} className="shrink-0 app-muted-text" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{category.title}</span>
                        <span className="shrink-0 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700">即将开放</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </details>
            </div>
            </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="font-semibold text-gray-900">暂无课程板块</p>
            </div>
          )}
        </section>
      </div>
  );
}

export default function CoursesPage() {
  return <CourseCatalog />;
}
