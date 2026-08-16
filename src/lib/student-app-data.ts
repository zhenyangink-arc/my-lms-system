import type { SupabaseClient } from "@supabase/supabase-js";

import {
  STUDENT_APP_IDS,
  type StudentAppSlug,
} from "@/lib/student-apps";

export type StudentAppCourseScope = {
  appId: string;
  categoryIds: string[];
  courseIds: string[];
  lessonIds: string[];
};

type QueryError = {
  code?: string;
  message?: string;
} | null;

export function isStudentAppSchemaMissing(error: QueryError) {
  return (
    error?.code === "42703" ||
    error?.code === "42P01" ||
    error?.message?.includes("student_app_id") === true ||
    error?.message?.includes("tenant_student_apps") === true ||
    error?.message?.includes("student_app_enrollments") === true
  );
}

export async function withStudentAppSchemaFallback<
  T extends { error: QueryError },
>(
  scopedQuery: PromiseLike<T>,
  _legacyQuery: () => PromiseLike<T>,
): Promise<T> {
  void _legacyQuery;
  // 应用域迁移已作为生产前置条件。查询失败时必须原样失败关闭，
  // 不能再执行未带 student_app_id 的旧查询，否则会把其他应用数据混入当前页面。
  return await scopedQuery;
}

export async function getStudentAppCourseScope(
  supabase: SupabaseClient,
  appSlug: StudentAppSlug,
): Promise<StudentAppCourseScope> {
  const appId = STUDENT_APP_IDS[appSlug];
  const { data: categoryData, error: categoryError } = await supabase
    .from("course_categories")
    .select("id")
    .eq("student_app_id", appId)
    .eq("is_published", true);

  if (categoryError) {
    return { appId, categoryIds: [], courseIds: [], lessonIds: [] };
  }
  const categoryIds = (categoryData ?? []).map((category) => String(category.id));

  if (categoryIds.length === 0) {
    return { appId, categoryIds: [], courseIds: [], lessonIds: [] };
  }

  const { data: courseData } = await supabase
    .from("courses")
    .select("id")
    .in("category_id", categoryIds)
    .eq("is_published", true);
  const courseIds = (courseData ?? []).map((course) => String(course.id));

  if (courseIds.length === 0) {
    return { appId, categoryIds, courseIds: [], lessonIds: [] };
  }

  const { data: lessonData } = await supabase
    .from("lessons")
    .select("id")
    .in("course_id", courseIds)
    .eq("is_published", true);
  const lessonIds = (lessonData ?? []).map((lesson) => String(lesson.id));

  return { appId, categoryIds, courseIds, lessonIds };
}
