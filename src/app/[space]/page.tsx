import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { requireDashboardAccess } from "@/lib/dashboard-access";
import {
  MEMBERSHIP_TIER_LABELS,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { PortalTopbar } from "./PortalTopbar";
import {
  PortalCourseGrid,
  type PortalCourseCard,
} from "./PortalCourseGrid";
import { PortalCourseSearchProvider } from "./PortalCourseSearch";

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
};

type Lesson = {
  id: string;
  course_id: string;
};

type LessonProgress = {
  lesson_id: string;
  status: string;
};

export default async function StudentPortalPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const access = await requireDashboardAccess("tenant", space);

  if (access.auth.profile?.role !== "student") {
    redirect(access.dashboardBasePath);
  }

  const { supabase, user, profile, tenant } = access.auth;
  const dashboardBasePath = access.dashboardBasePath;
  const portalPath = dashboardBasePath.slice(0, -"/dashboard".length);
  const userName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";
  const accountLabel =
    MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile?.membership_tier)];
  const { data: parentCategoryData, error: parentCategoryError } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug")
    .is("parent_id", null)
    .eq("is_published", true);

  const parentCategories = (parentCategoryData ?? []) as CourseCategory[];
  const parentCategoryIds = parentCategories.map((category) => category.id);

  const { data: subcategoryData, error: subcategoryError } =
    parentCategoryIds.length > 0
      ? await supabase
          .from("course_categories")
          .select("id, parent_id, slug")
          .in("parent_id", parentCategoryIds)
          .eq("is_published", true)
      : { data: [] as CourseCategory[], error: null };

  const subcategories = (subcategoryData ?? []) as CourseCategory[];
  const subcategoryIds = subcategories.map((category) => category.id);

  const { data: courseData, error: courseError } =
    subcategoryIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, category_id, slug, title, description, cover_url")
          .in("category_id", subcategoryIds)
          .eq("is_published", true)
          .order("sort_order", { ascending: true })
      : { data: [] as Course[], error: null };

  const courses = (courseData ?? []) as Course[];
  const courseIds = courses.map((course) => course.id);

  const { data: lessonData, error: lessonError } =
    courseIds.length > 0
      ? await supabase
          .from("lessons")
          .select("id, course_id")
          .in("course_id", courseIds)
          .eq("is_published", true)
      : { data: [] as Lesson[], error: null };

  const lessons = (lessonData ?? []) as Lesson[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  const { data: progressData, error: progressError } =
    lessonIds.length > 0
      ? await supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds)
      : { data: [] as LessonProgress[], error: null };

  const hasCourseDataError = Boolean(
    parentCategoryError ||
      subcategoryError ||
      courseError ||
      lessonError ||
      progressError
  );

  const parentCategoryById = new Map(
    parentCategories.map((category) => [category.id, category])
  );
  const subcategoryById = new Map(
    subcategories.map((category) => [category.id, category])
  );
  const lessonsByCourseId = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const currentLessons = lessonsByCourseId.get(lesson.course_id) ?? [];
    currentLessons.push(lesson);
    lessonsByCourseId.set(lesson.course_id, currentLessons);
  });

  const completedLessonIds = new Set(
    ((progressData ?? []) as LessonProgress[])
      .filter((progress) => progress.status === "completed")
      .map((progress) => progress.lesson_id)
  );

  const portalCourses = courses.flatMap<PortalCourseCard>((course) => {
    const subcategory = course.category_id
      ? subcategoryById.get(course.category_id)
      : null;
    const parentCategory = subcategory?.parent_id
      ? parentCategoryById.get(subcategory.parent_id)
      : null;

    if (!subcategory || !parentCategory) return [];

    const courseLessons = lessonsByCourseId.get(course.id) ?? [];
    const completedLessons = courseLessons.filter((lesson) =>
      completedLessonIds.has(lesson.id)
    ).length;
    const progressPercent =
      courseLessons.length > 0
        ? Math.round((completedLessons / courseLessons.length) * 100)
        : 0;

    return [
      {
        id: course.id,
        title: course.title,
        description: course.description,
        coverUrl: course.cover_url,
        href: `/${encodeURIComponent(space)}/dashboard/courses/${encodeURIComponent(parentCategory.slug)}/${encodeURIComponent(subcategory.slug)}/${encodeURIComponent(course.slug)}`,
        completedLessons,
        lessonCount: courseLessons.length,
        progressPercent,
      },
    ];
  });

  return (
    <PortalCourseSearchProvider>
      <PortalTopbar
        portalPath={portalPath}
        dashboardBasePath={dashboardBasePath}
        tenantName={tenant?.name ?? space}
        userName={userName}
        accountLabel={accountLabel}
        studentId={user.id}
      />
      <main className="min-h-screen bg-slate-50 px-8 pb-10 pt-[6.5rem] text-slate-950">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">课程</h1>

          {hasCourseDataError ? (
            <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
              <h2 className="text-lg font-semibold text-red-900">
                课程加载失败
              </h2>
              <p className="mt-2 text-sm text-red-700">
                暂时无法获取课程数据，请稍后刷新页面重试。
              </p>
            </section>
          ) : courses.length === 0 ? (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
              <BookOpen className="mx-auto text-slate-400" size={32} />
              <h2 className="mt-4 text-lg font-semibold">暂无课程</h2>
              <p className="mt-2 text-sm text-slate-500">
                当前机构还没有发布课程，请稍后再来查看。
              </p>
            </section>
          ) : (
            <PortalCourseGrid courses={portalCourses} />
          )}
        </div>
      </main>
    </PortalCourseSearchProvider>
  );
}
