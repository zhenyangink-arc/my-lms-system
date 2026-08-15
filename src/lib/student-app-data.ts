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
  legacyQuery: () => PromiseLike<T>,
): Promise<T> {
  const result = await scopedQuery;
  return isStudentAppSchemaMissing(result.error) ? await legacyQuery() : result;
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

  let categoryIds = (categoryData ?? []).map((category) => String(category.id));

  // 迁移部署前的开发数据库仍可通过现有一级分类读取，部署后以 student_app_id 为准。
  if (categoryError) {
    const categorySlug = appSlug === "study-abroad" ? "service" : appSlug;
    const { data: rootData } = await supabase
      .from("course_categories")
      .select("id")
      .is("parent_id", null)
      .eq("slug", categorySlug)
      .eq("is_published", true)
      .maybeSingle();

    if (rootData?.id) {
      const { data: childData } = await supabase
        .from("course_categories")
        .select("id")
        .eq("parent_id", rootData.id)
        .eq("is_published", true);
      categoryIds = [
        String(rootData.id),
        ...(childData ?? []).map((category) => String(category.id)),
      ];
    }
  }

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
