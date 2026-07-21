/**
 * 管理端课程首页
 *
 * 这个页面是课程管理的第一层入口。
 *
 * 功能：
 * 1. 检查当前用户是否为 admin / tenant_super_admin
 * 2. 统计系统中的课程数量、课时数量、R2 视频绑定数量
 * 3. 只显示一级课程板块，例如：
 *    - 留学服务课程
 *    - 韩语课程
 *    - 英语课程
 *    - 数学课程
 *    - 大学课程
 * 4. 不在首页展开所有二级分类和课程，避免页面太乱
 * 5. 点击“进入管理”后进入该一级板块的管理页
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  Languages,
  Settings,
  Video,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { FocusCourseAdminCard } from "./FocusCourseManagement";


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
};

type Lesson = {
  id: string;
  course_id: string;
  is_published: boolean;
  video_provider: string | null;
  video_object_key: string | null;
};

const categoryIconMap: Record<string, LucideIcon> = {
  service: FileCheck2,
  korean: Languages,
  english: BookOpen,
  math: Calculator,
  university: GraduationCap,
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

export default async function AdminCoursesPage() {
  const { supabase } = await requireAdmin();

  /**
   * 1. 查询所有课程分类
   * 包括一级板块和二级分类。
   */
  const { data: categoryData } = await supabase
    .from("course_categories")
    .select(
      "id, parent_id, slug, title, description, icon_name, accent_color, sort_order"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const categories = (categoryData ?? []) as CourseCategory[];

  /**
   * 2. 查询所有课程
   */
  const { data: courseData } = await supabase
    .from("courses")
    .select("id, category_id")
    .eq("is_published", true);

  const courses = (courseData ?? []) as Course[];

  /**
   * 3. 查询所有课时
   */
  const { data: lessonData } = await supabase
    .from("lessons")
    .select("id, course_id, is_published, video_provider, video_object_key");

  const lessons = (lessonData ?? []) as Lesson[];

  /**
   * 4. 整理一级板块、二级分类、课程、课时之间的关系
   */
  const parentCategories = categories.filter(
    (category) => category.parent_id === null
  );

  const subcategoriesByParentId = new Map<string, CourseCategory[]>();

  categories.forEach((category) => {
    if (!category.parent_id) {
      return;
    }

    const current = subcategoriesByParentId.get(category.parent_id) ?? [];
    current.push(category);
    subcategoriesByParentId.set(category.parent_id, current);
  });

  const lessonsByCourseId = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const current = lessonsByCourseId.get(lesson.course_id) ?? [];
    current.push(lesson);
    lessonsByCourseId.set(lesson.course_id, current);
  });

  const totalCourses = courses.length;
  const totalLessons = lessons.length;
  const publishedLessons = lessons.filter((lesson) => lesson.is_published);
  const r2VideoLessons = lessons.filter(
    (lesson) => lesson.video_provider === "r2" && lesson.video_object_key
  );

  // 留学服务课与韩语课使用新的重点运营工作台，其余三类课程保持原布局。
  const focusCategories = parentCategories.filter(
    (category) => category.slug === "service" || category.slug === "korean"
  );
  const legacyCategories = parentCategories.filter(
    (category) => category.slug !== "service" && category.slug !== "korean"
  );

  function getCategoryMetrics(category: CourseCategory) {
    const subcategories = subcategoriesByParentId.get(category.id) ?? [];
    const subcategoryIds = new Set(
      subcategories.map((subcategory) => subcategory.id)
    );
    const categoryCourses = courses.filter(
      (course) => course.category_id && subcategoryIds.has(course.category_id)
    );
    const categoryCourseIds = new Set(
      categoryCourses.map((course) => course.id)
    );
    const categoryLessons = lessons.filter((lesson) =>
      categoryCourseIds.has(lesson.course_id)
    );

    return {
      subcategories,
      categoryCourses,
      categoryLessons,
      publishedCount: categoryLessons.filter((lesson) => lesson.is_published)
        .length,
      r2Count: categoryLessons.filter(
        (lesson) =>
          lesson.video_provider === "r2" && Boolean(lesson.video_object_key)
      ).length,
    };
  }

  return (
    <>
      <DashboardPageHeader
        title="课程 / 课时管理"
        description="按课程板块管理课程结构、课时信息和 R2 视频路径。"
      />

      <div className="space-y-5 p-5">
        {/* 顶部统计 */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">课程数量</p>
              <GraduationCap className="text-gray-300" size={24} />
            </div>

            <p className="mt-3 text-2xl font-black text-gray-900">
              {totalCourses}
            </p>

            <p className="mt-1 text-xs text-gray-500">当前系统课程总数</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">课时数量</p>
              <BookOpen className="text-gray-300" size={24} />
            </div>

            <p className="mt-3 text-2xl font-black text-gray-900">
              {publishedLessons.length} / {totalLessons}
            </p>

            <p className="mt-1 text-xs text-gray-500">已发布 / 全部课时</p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">R2 视频</p>
              <Video className="text-gray-300" size={24} />
            </div>

            <p className="mt-3 text-2xl font-black text-gray-900">
              {r2VideoLessons.length}
            </p>

            <p className="mt-1 text-xs text-gray-500">已绑定 R2 视频的课时</p>
          </div>
        </section>

        {/* 两条核心业务线使用更完整的内容运营视图。 */}
        {focusCategories.length > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xl font-black tracking-tight">重点运营课程</p>
                <p className="app-muted-text mt-1 text-sm">
                  同时检查课程路线、课时发布和视频覆盖情况。
                </p>
              </div>
              <span className="app-muted-text text-xs font-bold">
                留学服务 + 韩语成长双主线
              </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {focusCategories.map((category) => {
                const metrics = getCategoryMetrics(category);

                return (
                  <FocusCourseAdminCard
                    key={category.id}
                    kind={category.slug as "service" | "korean"}
                    title={category.title}
                    description={category.description}
                    categoryCount={metrics.subcategories.length}
                    courseCount={metrics.categoryCourses.length}
                    lessonCount={metrics.categoryLessons.length}
                    publishedCount={metrics.publishedCount}
                    videoCount={metrics.r2Count}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* 一级课程板块 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-gray-900">
                其他课程板块
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                英语、数学和大学课程继续使用原有管理方式。
              </p>
            </div>

            <Settings className="text-gray-300" size={28} />
          </div>

          {legacyCategories.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {legacyCategories.map((category) => {
                const {
                  subcategories,
                  categoryCourses,
                  categoryLessons,
                  publishedCount,
                  r2Count,
                } = getCategoryMetrics(category);

                const color =
                  colorMap[category.accent_color ?? "indigo"] ??
                  colorMap.indigo;

                const CategoryIcon =
                  categoryIconMap[category.slug] ?? FolderOpen;

                return (
                  <article
                    key={category.id}
                    className="flex h-full flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${color.iconBox}`}
                      >
                        <CategoryIcon className={color.iconText} size={27} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${color.badge}`}
                          >
                            {category.title}
                          </span>
                        </div>

                        <h3 className="text-lg font-black tracking-tight text-gray-900">
                          {category.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                          {category.description || "暂无课程板块简介"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm font-bold text-gray-900">
                        内容概览
                      </p>

                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        {subcategories.length} 个分类 ·{" "}
                        {categoryCourses.length} 门课程 ·{" "}
                        {categoryLessons.length} 个课时
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white px-3 py-2">
                          <p className="text-xs text-gray-400">已发布课时</p>
                          <p className="mt-1 text-sm font-black text-gray-900">
                            {publishedCount}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white px-3 py-2">
                          <p className="text-xs text-gray-400">R2 视频</p>
                          <p className="mt-1 text-sm font-black text-gray-900">
                            {r2Count}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/admin/courses/category/${category.slug}`}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                      进入管理
                      <ArrowRight size={15} />
                    </Link>
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
    </>
  );
}
