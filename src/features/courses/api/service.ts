import "server-only";

import { requireAdmin } from "@/lib/admin";
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

export async function getCourseManagementData(
  selection: CourseManagementSelection = {},
): Promise<CourseManagementData> {
  // 原样保留旧读取边界：requireAdmin() 加当前用户 Supabase 客户端与 RLS。
  // 写权限仍由已有 Server Actions 校验，不在数据层另建一套权限判断。
  const { supabase, globalRole } = await requireAdmin();
  const canManage =
    globalRole === "platform_owner" || globalRole === "platform_admin";

  const [categoryResult, courseResult, lessonResult, chapterResult] =
    await Promise.all([
      supabase
        .from("course_categories")
        .select(CATEGORY_COLUMNS)
        .eq("content_scope", "platform")
        .order("sort_order"),
      supabase
        .from("courses")
        .select(COURSE_COLUMNS)
        .eq("content_scope", "platform")
        .order("sort_order"),
      supabase
        .from("lessons")
        .select(LESSON_COLUMNS)
        .eq("content_scope", "platform")
        .order("sort_order"),
      supabase
        .from("course_chapters")
        .select(CHAPTER_COLUMNS)
        .eq("content_scope", "platform")
        .order("sort_order"),
    ]);

  const categories = (categoryResult.data ?? []) as CourseCategory[];
  const courses = (courseResult.data ?? []) as CourseCatalogCourse[];
  const lessons = (lessonResult.data ?? []) as CourseCatalogLesson[];
  const chapters = (chapterResult.data ?? []) as CourseCatalogChapter[];
  const catalogError =
    categoryResult.error ||
    courseResult.error ||
    lessonResult.error ||
    chapterResult.error;

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
