import "server-only";

import { getKoreanBeginnerLesson } from "@/lib/korean-curriculum";
import { requireLibraryOverviewAccess } from "@/lib/resource-library";
import type {
  LibraryCourseCategory,
  LibraryCourseRow,
  LibraryManagementResult,
  LibraryManagementScope,
  LibraryRawCourse,
  LibraryRawLesson,
  LibraryResourceRow,
} from "./types";

export async function getLibraryManagementData(): Promise<LibraryManagementResult> {
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

  const [resourcesResult, coursesResult, categoriesResult, lessonsResult] =
    await Promise.all([
      resourcesQuery
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      coursesQuery.order("sort_order", { ascending: true }).order("title"),
      categoriesQuery
        .order("sort_order", { ascending: true })
        .order("title"),
      lessonsQuery
        .order("course_id")
        .order("sort_order", { ascending: true }),
    ]);

  const resources = (resourcesResult.data ?? []) as LibraryResourceRow[];
  const rawCourses = (coursesResult.data ?? []) as LibraryRawCourse[];
  const categories = (
    categoriesResult.data ?? []
  ) as LibraryCourseCategory[];
  const rawLessons = (lessonsResult.data ?? []) as LibraryRawLesson[];
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const lessonsByCourse = new Map<string, LibraryRawLesson[]>();

  for (const lesson of rawLessons) {
    lessonsByCourse.set(lesson.course_id, [
      ...(lessonsByCourse.get(lesson.course_id) ?? []),
      lesson,
    ]);
  }

  const courses: LibraryCourseRow[] = rawCourses
    .flatMap((course) => {
      const path: LibraryCourseCategory[] = [];
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

  return {
    scope: scope as LibraryManagementScope,
    role,
    canCurate,
    courses,
    resources,
    hasError: Boolean(
      resourcesResult.error ||
        coursesResult.error ||
        categoriesResult.error ||
        lessonsResult.error,
    ),
  };
}
