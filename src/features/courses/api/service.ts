import "server-only";

import { requireAdmin } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { requireTenantAppCapability } from "@/lib/tenant-app-capabilities";
import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCategory,
  CourseLessonResource,
  CourseManagementData,
  CourseManagementSelection,
} from "./types";

const CATEGORY_COLUMNS =
  "id,parent_id,slug,title,description,icon_name,accent_color,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,content_scope";
const COURSE_COLUMNS =
  "id,category_id,slug,title,description,level,icon_name,cover_url,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked,content_scope";
const LESSON_COLUMNS =
  "id,course_id,slug,title,description,lesson_type,duration_minutes,is_free_preview,video_provider,video_url,video_object_key,video_mime_type,learning_objectives,lesson_tasks,teacher_note,content_text,key_points,case_study,common_mistakes,summary_text,reflection_questions,extra_note,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,required_score,available_from,is_manually_locked,content_scope";
const CHAPTER_COLUMNS =
  "id,lesson_id,chapter_test_id,slug,title,description,duration_minutes,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,completion_rule,unlock_mode,prerequisite_chapter_id,required_score,available_from,is_manually_locked,content_scope";
const RESOURCE_COLUMNS =
  "id,lesson_id,title,description,resource_type,resource_url,resource_object_key,original_file_name,is_required,is_published,sort_order,is_deleted,deleted_at,delete_reason";

type LessonWithChapters = CourseCatalogLesson & {
  course_chapters: CourseCatalogChapter[];
};

export async function getCourseManagementData(
  selection: CourseManagementSelection = {},
  studentAppId?: string,
): Promise<CourseManagementData> {
  const activeUser = studentAppId ? await requireActiveUser() : null;
  const applicationAccess =
    studentAppId && activeUser?.tenant
      ? await requireTenantAppCapability(studentAppId, "manageContent")
      : null;
  // 应用工作区允许获授权的机构员工查看当前应用内容；平台内容写入仍只由
  // 现有 Server Actions 和平台角色控制，机构权限不会升级为平台编辑权限。
  const legacyAccess = applicationAccess ? null : await requireAdmin();
  const supabase = applicationAccess
    ? applicationAccess.supabase
    : legacyAccess!.supabase;
  const globalRole = legacyAccess?.globalRole ?? null;
  const tenantSlug = applicationAccess?.tenantSlug ?? legacyAccess?.tenant?.slug;
  const canManage =
    globalRole === "platform_owner" || globalRole === "platform_admin";

  let categoryQuery = supabase
    .from("course_categories")
    .select(CATEGORY_COLUMNS)
    .eq("content_scope", "platform");
  let courseQuery = supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("content_scope", "platform");

  if (studentAppId) {
    categoryQuery = categoryQuery.eq("student_app_id", studentAppId);
    courseQuery = courseQuery.eq("student_app_id", studentAppId);
  }

  const [categoryResult, courseResult] = await Promise.all([
    categoryQuery.order("sort_order"),
    courseQuery.order("sort_order"),
  ]);

  const categories = (categoryResult.data ?? []) as CourseCategory[];
  const courses = (courseResult.data ?? []) as CourseCatalogCourse[];
  const courseIds = courses.map((course) => course.id);
  let lessonQuery = supabase
    .from("lessons")
    .select(
      `${LESSON_COLUMNS},course_chapters!course_chapters_lesson_id_fkey(${CHAPTER_COLUMNS})`,
    )
    .eq("content_scope", "platform")
    .eq("course_chapters.content_scope", "platform");
  if (studentAppId) lessonQuery = lessonQuery.in("course_id", courseIds);
  const lessonResult = courseIds.length || !studentAppId
    ? await lessonQuery
        .order("sort_order")
        .order("sort_order", { referencedTable: "course_chapters" })
    : { data: [] as LessonWithChapters[], error: null };
  const lessonRows = (lessonResult.data ?? []) as LessonWithChapters[];
  const lessons = lessonRows.map((row) => {
    const lesson = { ...row };
    Reflect.deleteProperty(lesson, "course_chapters");
    return lesson;
  });
  const chapters = lessonRows
    .flatMap((lesson) => lesson.course_chapters)
    .sort((left, right) => left.sort_order - right.sort_order);
  const catalogError =
    categoryResult.error ||
    courseResult.error ||
    lessonResult.error;

  let resources: CourseLessonResource[] = [];
  let resourceErrorMessage: string | null = null;
  const selectedLesson =
    selection.node === "lesson" && selection.id
      ? lessons.find((lesson) => lesson.id === selection.id)
      : null;

  if (selectedLesson) {
    const resourceResult = await supabase
      .from("lesson_resources")
      .select(RESOURCE_COLUMNS)
      .eq("lesson_id", selectedLesson.id)
      .eq("content_scope", "platform")
      .order("sort_order");
    resources = (resourceResult.data ?? []) as CourseLessonResource[];
    resourceErrorMessage = resourceResult.error?.message ?? null;
  }

  return {
    dashboardBasePath: getDashboardBasePath(tenantSlug),
    globalRole,
    canManage,
    canPermanentlyDeleteResources: globalRole === "platform_owner",
    categories,
    courses,
    lessons,
    chapters,
    resources,
    catalogErrorMessage: catalogError?.message ?? null,
    resourceErrorMessage,
  };
}
