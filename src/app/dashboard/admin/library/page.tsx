import { Library, ShieldCheck } from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { getKoreanBeginnerLesson } from "@/lib/korean-curriculum";
import { requireLibraryOverviewAccess } from "@/lib/resource-library";
import {
  LibraryCourseResourceTable,
  type LibraryCourseRow,
  type LibraryResourceRow,
} from "./LibraryCourseResourceTable";

type RawCourse = {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  is_published: boolean;
};

type CourseCategory = {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number;
  is_published: boolean;
};

type RawLesson = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  sort_order: number;
  is_published: boolean;
};

export default async function LibraryManagementPage() {
  const access = await requireLibraryOverviewAccess();
  const { supabase, canCurate, scope, role } = access;

  let resourcesQuery = supabase
    .from("library_resources")
    .select(
      "id,course_id,lesson_id,title,description,category,resource_type,original_file_name,file_size,status,is_featured,sort_order,download_count,updated_at",
    );
  let coursesQuery = supabase
    .from("courses")
    .select("id,category_id,title,slug,sort_order,is_published")
    .eq("content_scope", "platform");
  let categoriesQuery = supabase
    .from("course_categories")
    .select("id,parent_id,title,sort_order,is_published")
    .eq("content_scope", "platform");
  let lessonsQuery = supabase
    .from("lessons")
    .select("id,course_id,title,slug,sort_order,is_published")
    .eq("content_scope", "platform");

  if (scope === "institution") {
    resourcesQuery = resourcesQuery.eq("status", "published");
    coursesQuery = coursesQuery.eq("is_published", true);
    categoriesQuery = categoriesQuery.eq("is_published", true);
    lessonsQuery = lessonsQuery.eq("is_published", true);
  }

  const [resourcesResult, coursesResult, categoriesResult, lessonsResult] = await Promise.all([
    resourcesQuery
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false }),
    coursesQuery.order("sort_order", { ascending: true }).order("title"),
    categoriesQuery.order("sort_order", { ascending: true }).order("title"),
    lessonsQuery.order("course_id").order("sort_order", { ascending: true }),
  ]);
  const resources = (resourcesResult.data ?? []) as LibraryResourceRow[];
  const rawCourses = (coursesResult.data ?? []) as RawCourse[];
  const categories = (categoriesResult.data ?? []) as CourseCategory[];
  const rawLessons = (lessonsResult.data ?? []) as RawLesson[];
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const lessonsByCourse = new Map<string, RawLesson[]>();
  for (const lesson of rawLessons) {
    lessonsByCourse.set(lesson.course_id, [
      ...(lessonsByCourse.get(lesson.course_id) ?? []),
      lesson,
    ]);
  }
  const courses: LibraryCourseRow[] = rawCourses
    .flatMap((course) => {
      const path: CourseCategory[] = [];
      const visited = new Set<string>();
      let current = course.category_id
        ? categoryById.get(course.category_id)
        : undefined;
      while (current && !visited.has(current.id)) {
        path.unshift(current);
        visited.add(current.id);
        current = current.parent_id
          ? categoryById.get(current.parent_id)
          : undefined;
      }
      const rootCategory = path[0];
      const leafCategory = path[path.length - 1];
      const lessonTargets = lessonsByCourse.get(course.id) ?? [];
      const targets =
        lessonTargets.length > 0
          ? lessonTargets
          : [
              {
                id: `course:${course.id}`,
                course_id: course.id,
                title: "课程公共资料",
                slug: `${course.slug}-general`,
                sort_order: 0,
                is_published: course.is_published,
              },
            ];

      return targets.map((lesson) => ({
        id: lesson.id,
        course_id: course.id,
        lesson_id: lesson.id.startsWith("course:") ? null : lesson.id,
        title:
          getKoreanBeginnerLesson(lesson.slug)?.title ??
          lesson.title.replace(/^第\s*\d+\s*课\s*[：:]\s*/, ""),
        slug: lesson.slug,
        sort_order: lesson.sort_order,
        is_published: lesson.is_published && course.is_published,
        group_title: rootCategory?.title ?? "未归类课程",
        group_order: rootCategory?.sort_order ?? Number.MAX_SAFE_INTEGER,
        category_label: course.title,
        category_order:
          (leafCategory?.sort_order ?? 9999) * 100000 + course.sort_order,
      }));
    })
    .sort(
      (left, right) =>
        left.group_order - right.group_order ||
        left.category_order - right.category_order ||
        left.sort_order - right.sort_order ||
        left.title.localeCompare(right.title, "zh-CN"),
    );
  const publishedCount = resources.filter(
    (resource) => resource.status === "published",
  ).length;
  const draftCount = resources.length - publishedCount;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-4 px-4 sm:px-6 lg:px-8">
        <section className="app-card rounded-2xl border px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
                  }}
                >
                  <Library size={15} />
                </span>
                <span className="app-muted-text inline-flex items-center gap-1.5 text-[10px] font-black">
                  <ShieldCheck size={11} />
                  {canCurate
                    ? "平台负责人维护"
                    : role === "tenant_super_admin"
                      ? "机构负责人只读"
                      : "机构只读"}
                </span>
              </div>
              <DashboardTitleWithHint
                className="mt-2"
                title="资料库管理"
                description={
                  canCurate
                    ? "按课程目录找到目标课程，直接上传或进入资料管理。"
                    : "按课程目录查看平台资料；机构只能查看和下载。"
                }
              />
            </div>
            <dl className="grid shrink-0 grid-cols-3 overflow-hidden rounded-xl border text-center">
              {[
                ["课级目录", courses.length],
                ["已发布资料", publishedCount],
                ["草稿/归档", draftCount],
              ].map(([label, value], index) => (
                <div
                  key={String(label)}
                  className={`min-w-[100px] px-4 py-3 ${index > 0 ? "border-l" : ""}`}
                  style={{ borderColor: "var(--app-border-soft)" }}
                >
                  <dt className="app-muted-text text-[9px] font-black">
                    {label}
                  </dt>
                  <dd className="mt-1 font-mono text-lg font-black">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {!canCurate && (
          <section
            className="rounded-xl border px-4 py-2.5 text-[10px] font-bold"
            style={{
              color: "var(--app-secondary)",
              borderColor: "var(--app-secondary)",
              backgroundColor: "var(--app-secondary-soft)",
            }}
          >
            当前机构处于只读模式：可以进入课程资料窗口查看和下载，不能上传或修改。
          </section>
        )}

        {(resourcesResult.error ||
          coursesResult.error ||
          categoriesResult.error ||
          lessonsResult.error) && (
          <section
            className="rounded-xl border p-3 text-xs font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            资料库数据暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <LibraryCourseResourceTable
          canCurate={canCurate}
          courses={courses}
          resources={resources}
        />
      </div>
    </div>
  );
}
