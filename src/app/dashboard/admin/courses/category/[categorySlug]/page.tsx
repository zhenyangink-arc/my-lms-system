/**
 * 管理端一级课程板块页面
 *
 * 这个页面是课程管理的第二层。
 *
 * 例如：
 * /dashboard/admin/courses/category/service
 *
 * 功能：
 * 1. 显示某个一级课程板块的信息
 * 2. 显示这个板块下面的二级分类
 * 3. 每个二级分类显示课程数、课时数、R2 视频数量
 * 4. 点击“管理课程”进入该二级分类下的具体课程管理页
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Layers3,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { FocusCategoryAdminView } from "../../FocusCourseManagement";

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
};

type Lesson = {
  id: string;
  course_id: string;
  is_published: boolean;
  video_provider: string | null;
  video_object_key: string | null;
};

export default async function AdminCourseCategoryPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
  }>;
}) {
  const { categorySlug } = await params;

  const { supabase } = await requireAdmin();

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
   * 2. 查询二级分类
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
   * 3. 查询二级分类下面的具体课程
   */
  let courses: Course[] = [];

  if (subcategoryIds.length > 0) {
    const { data: courseData } = await supabase
      .from("courses")
      .select("id, category_id")
      .in("category_id", subcategoryIds);

    courses = (courseData ?? []) as Course[];
  }

  const courseIds = courses.map((course) => course.id);

  /**
   * 4. 查询具体课程下面的课时
   */
  let lessons: Lesson[] = [];

  if (courseIds.length > 0) {
    const { data: lessonData } = await supabase
      .from("lessons")
      .select("id, course_id, is_published, video_provider, video_object_key")
      .in("course_id", courseIds);

    lessons = (lessonData ?? []) as Lesson[];
  }

  const coursesBySubcategoryId = new Map<string, Course[]>();

  courses.forEach((course) => {
    if (!course.category_id) {
      return;
    }

    const current = coursesBySubcategoryId.get(course.category_id) ?? [];
    current.push(course);
    coursesBySubcategoryId.set(course.category_id, current);
  });

  const totalCourses = courses.length;
  const totalLessons = lessons.length;
  const r2VideoLessons = lessons.filter(
    (lesson) => lesson.video_provider === "r2" && lesson.video_object_key
  ).length;

  // 只重做留学服务课与韩语课；其他课程继续执行下方原有页面结构。
  if (categorySlug === "service" || categorySlug === "korean") {
    const focusItems = subcategories.map((subcategory) => {
      const subcategoryCourses =
        coursesBySubcategoryId.get(subcategory.id) ?? [];
      const subcategoryCourseIds = new Set(
        subcategoryCourses.map((course) => course.id)
      );
      const subcategoryLessons = lessons.filter((lesson) =>
        subcategoryCourseIds.has(lesson.course_id)
      );

      return {
        id: subcategory.id,
        slug: subcategory.slug,
        title: subcategory.title,
        description: subcategory.description,
        courseCount: subcategoryCourses.length,
        lessonCount: subcategoryLessons.length,
        publishedCount: subcategoryLessons.filter(
          (lesson) => lesson.is_published
        ).length,
        videoCount: subcategoryLessons.filter(
          (lesson) =>
            lesson.video_provider === "r2" && Boolean(lesson.video_object_key)
        ).length,
      };
    });

    return (
      <FocusCategoryAdminView
        kind={categorySlug}
        title={parentCategory.title}
        description={parentCategory.description}
        items={focusItems}
      />
    );
  }

  return (
    <>
      <DashboardPageHeader
        title={`${parentCategory.title}管理`}
        description={
          parentCategory.description ||
          "查看该课程板块下面的二级分类和课程结构。"
        }
      />

      <div className="space-y-6 p-6">
        <div>
          <Link
            href="/dashboard/admin/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回课程管理
          </Link>
        </div>

        {/* 当前板块概览 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                  {parentCategory.title}
                </span>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {subcategories.length} 个分类
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                选择二级分类
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                先选择二级分类，再进入具体课程和课时管理。
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">内容概览</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {totalCourses} 门课程 · {totalLessons} 个课时
                  </p>
                </div>

                <Layers3 className="text-gray-300" size={24} />
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-full rounded-full bg-orange-500" />
              </div>

              <p className="mt-3 text-xs text-gray-400">
                已绑定 R2 视频 {r2VideoLessons} 个课时
              </p>
            </div>
          </div>
        </section>

        {/* 二级分类列表 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                二级分类
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                当前板块下共有 {subcategories.length} 个二级分类。
              </p>
            </div>

            <FolderOpen className="text-gray-300" size={28} />
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

                const publishedLessons = subcategoryLessons.filter(
                  (lesson) => lesson.is_published
                ).length;

                const r2Lessons = subcategoryLessons.filter(
                  (lesson) =>
                    lesson.video_provider === "r2" && lesson.video_object_key
                ).length;

                return (
                  <article
                    key={subcategory.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px_150px] lg:items-center">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                          <FolderOpen size={28} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                              {subcategory.title}
                            </span>

                            {publishedLessons === subcategoryLessons.length &&
                            subcategoryLessons.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                <CheckCircle2 size={13} />
                                全部发布
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                部分发布
                              </span>
                            )}
                          </div>

                          <h4 className="text-lg font-black tracking-tight text-gray-900">
                            {subcategory.title}
                          </h4>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                            {subcategory.description || "暂无分类简介"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>课程</span>
                          <span>{subcategoryCourses.length} 门</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>课时</span>
                          <span>
                            {publishedLessons} / {subcategoryLessons.length}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>R2 视频</span>
                          <span>
                            {r2Lessons} / {subcategoryLessons.length}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/admin/courses/category/${parentCategory.slug}/${subcategory.slug}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 lg:w-auto"
                      >
                        管理课程
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="font-semibold text-gray-900">暂无二级分类</p>
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
