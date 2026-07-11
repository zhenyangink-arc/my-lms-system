/**
 * 管理端二级分类课程页面
 *
 * 这个页面是课程管理的第三层。
 *
 * 例如：
 * /dashboard/admin/courses/category/service/service-application
 *
 * 功能：
 * 1. 显示某个二级分类下面的具体课程
 * 2. 每门课程显示课时数量、已发布课时数量、R2 视频绑定数量
 * 3. 点击“管理课时”进入单门课程的课时管理页
 * 4. 单门课程课时管理页仍然使用已有路由：
 *    /dashboard/admin/courses/[courseId]
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Video,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  is_published: boolean;
  sort_order: number;
};

type Lesson = {
  id: string;
  course_id: string;
  is_published: boolean;
  video_provider: string | null;
  video_object_key: string | null;
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

export default async function AdminSubcategoryCoursesPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
    subcategorySlug: string;
  }>;
}) {
  const { categorySlug, subcategorySlug } = await params;

  const { supabase } = await requireAdmin();

  /**
   * 1. 查询一级课程板块
   */
  const { data: parentCategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, sort_order")
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
    .select("id, parent_id, slug, title, description, sort_order")
    .eq("slug", subcategorySlug)
    .eq("parent_id", parentCategory.id)
    .eq("is_published", true)
    .maybeSingle();

  if (!subcategoryData) {
    notFound();
  }

  const subcategory = subcategoryData as CourseCategory;

  /**
   * 3. 查询这个二级分类下面的具体课程
   */
  const { data: courseData } = await supabase
    .from("courses")
    .select(
      "id, category_id, slug, title, description, level, is_published, sort_order"
    )
    .eq("category_id", subcategory.id)
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
      .select("id, course_id, is_published, video_provider, video_object_key")
      .in("course_id", courseIds);

    lessons = (lessonData ?? []) as Lesson[];
  }

  const lessonsByCourseId = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const current = lessonsByCourseId.get(lesson.course_id) ?? [];
    current.push(lesson);
    lessonsByCourseId.set(lesson.course_id, current);
  });

  const totalLessons = lessons.length;
  const publishedLessons = lessons.filter((lesson) => lesson.is_published);
  const r2Lessons = lessons.filter(
    (lesson) => lesson.video_provider === "r2" && lesson.video_object_key
  );

  return (
    <>
      <DashboardPageHeader
        title={`${subcategory.title}管理`}
        description={
          subcategory.description ||
          "查看该分类下面的具体课程，并进入课时管理。"
        }
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/admin/courses/category/${parentCategory.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回{parentCategory.title}管理
          </Link>

          <span className="text-sm text-gray-300">/</span>

          <Link
            href="/dashboard/admin/courses"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            课程管理
          </Link>
        </div>

        {/* 当前二级分类概览 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                  {parentCategory.title}
                </span>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {subcategory.title}
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                选择具体课程
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                这里集中管理当前分类下的课程，并进入每门课程的课时编辑页面。
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">内容概览</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {courses.length} 门课程 · {totalLessons} 个课时
                  </p>
                </div>

                <BookOpen className="text-gray-300" size={24} />
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-full rounded-full bg-orange-500" />
              </div>

              <p className="mt-3 text-xs text-gray-400">
                已发布 {publishedLessons.length} 个课时 · R2 视频{" "}
                {r2Lessons.length} 个课时
              </p>
            </div>
          </div>
        </section>

        {/* 具体课程列表 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                具体课程
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                当前分类下共有 {courses.length} 门课程。
              </p>
            </div>

            <GraduationCap className="text-gray-300" size={28} />
          </div>

          {courses.length > 0 ? (
            <div className="space-y-4">
              {courses.map((course) => {
                const courseLessons = lessonsByCourseId.get(course.id) ?? [];

                const publishedCount = courseLessons.filter(
                  (lesson) => lesson.is_published
                ).length;

                const r2Count = courseLessons.filter(
                  (lesson) =>
                    lesson.video_provider === "r2" && lesson.video_object_key
                ).length;

                const levelLabel = getCourseLevelLabel(course.level);

                return (
                  <article
                    key={course.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px_150px] lg:items-center">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                          <GraduationCap size={28} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                              {subcategory.title}
                            </span>

                            {levelLabel && (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                {levelLabel}
                              </span>
                            )}

                            {course.is_published ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                <CheckCircle2 size={13} />
                                已发布
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                未发布
                              </span>
                            )}
                          </div>

                          <h4 className="text-lg font-black tracking-tight text-gray-900">
                            {course.title}
                          </h4>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                            {course.description || "暂无课程简介"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>课时</span>
                          <span>
                            {publishedCount} / {courseLessons.length}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>R2 视频</span>
                          <span>
                            {r2Count} / {courseLessons.length}
                          </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{
                              width:
                                courseLessons.length > 0
                                  ? `${Math.round(
                                      (r2Count / courseLessons.length) * 100
                                    )}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/admin/courses/${course.id}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 lg:w-auto"
                      >
                        管理课时
                        <ArrowRight size={15} />
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
                当前分类下还没有课程。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}