import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getTeacherRecommendationPath,
  type TeacherRecommendationSourceLocation,
} from "@/features/student-home-learning/routes";
import type {
  CreateTeacherLearningRecommendationInput,
  TeacherLearningRecommendation,
  TeacherRecommendationSourceType,
} from "../types";

type RecommendationRow = {
  id: string;
  student_app_id: string;
  teacher_id: string;
  target_scope: "class" | "student";
  class_id: string | null;
  student_id: string | null;
  source_type: TeacherRecommendationSourceType;
  source_id: string;
  title: string;
  reason: string;
  is_required: boolean;
  starts_at: string;
  due_at: string;
  status: "active" | "withdrawn";
  created_at: string;
  updated_at: string;
};

type ChapterLocation = {
  chapterSlug: string;
  lessonSlug: string;
  courseSlug: string;
  categorySlug: string;
  subcategorySlug: string;
};

const RECOMMENDATION_COLUMNS =
  "id,student_app_id,teacher_id,target_scope,class_id,student_id,source_type,source_id,title,reason,is_required,starts_at,due_at,status,created_at,updated_at";

async function loadChapterLocation(
  supabase: SupabaseClient,
  chapterId: string,
  studentAppId: string,
): Promise<ChapterLocation> {
  const { data: chapter, error: chapterError } = await supabase
    .from("course_chapters")
    .select("slug,lesson_id")
    .eq("id", chapterId)
    .eq("is_published", true)
    .maybeSingle();
  if (chapterError || !chapter?.slug || !chapter.lesson_id) {
    throw new Error("推荐课程章节不存在或尚未发布", { cause: chapterError });
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("slug,course_id")
    .eq("id", chapter.lesson_id)
    .eq("is_published", true)
    .maybeSingle();
  if (lessonError || !lesson?.slug || !lesson.course_id) {
    throw new Error("推荐章节缺少有效课时路径", { cause: lessonError });
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("slug,category_id,student_app_id")
    .eq("id", lesson.course_id)
    .eq("student_app_id", studentAppId)
    .eq("is_published", true)
    .maybeSingle();
  if (courseError || !course?.slug || !course.category_id) {
    throw new Error("推荐章节不属于当前应用或缺少课程路径", {
      cause: courseError,
    });
  }

  const { data: subcategory, error: subcategoryError } = await supabase
    .from("course_categories")
    .select("slug,parent_id")
    .eq("id", course.category_id)
    .maybeSingle();
  if (subcategoryError || !subcategory?.slug || !subcategory.parent_id) {
    throw new Error("推荐课程缺少子分类路径", { cause: subcategoryError });
  }

  const { data: category, error: categoryError } = await supabase
    .from("course_categories")
    .select("slug")
    .eq("id", subcategory.parent_id)
    .maybeSingle();
  if (categoryError || !category?.slug) {
    throw new Error("推荐课程缺少主分类路径", { cause: categoryError });
  }

  return {
    chapterSlug: String(chapter.slug),
    lessonSlug: String(lesson.slug),
    courseSlug: String(course.slug),
    categorySlug: String(category.slug),
    subcategorySlug: String(subcategory.slug),
  };
}

async function resolveSourceLocation({
  supabase,
  studentAppId,
  sourceType,
  sourceId,
  targetStudentId,
}: {
  supabase: SupabaseClient;
  studentAppId: string;
  sourceType: TeacherRecommendationSourceType;
  sourceId: string;
  targetStudentId: string | null;
}): Promise<TeacherRecommendationSourceLocation> {
  if (sourceType === "review") {
    if (!targetStudentId) throw new Error("错题推荐只能发送给单个学生");
    const { data, error } = await supabase
      .from("student_review_items")
      .select("id")
      .eq("id", sourceId)
      .eq("student_id", targetStudentId)
      .eq("student_app_id", studentAppId)
      .maybeSingle();
    if (error || !data) {
      throw new Error("错题来源不属于目标学生或当前应用", { cause: error });
    }
    return { sourceType: "review" };
  }

  let chapterId = sourceId;
  let skill: string | null = null;
  if (sourceType === "chapter_practice") {
    const { data, error } = await supabase
      .from("chapter_practice_units")
      .select("course_chapter_id")
      .eq("id", sourceId)
      .eq("student_app_id", studentAppId)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data?.course_chapter_id) {
      throw new Error("章节巩固来源不属于当前应用或尚未发布", {
        cause: error,
      });
    }
    chapterId = String(data.course_chapter_id);
  } else if (sourceType === "specialized_practice") {
    const { data, error } = await supabase
      .from("growth_toolbox_exercises")
      .select("course_chapter_id,skill")
      .eq("id", sourceId)
      .eq("student_app_id", studentAppId)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data?.course_chapter_id || !data.skill) {
      throw new Error("专项训练来源不属于当前应用或缺少课程路径", {
        cause: error,
      });
    }
    chapterId = String(data.course_chapter_id);
    skill = String(data.skill);
  }

  const location = await loadChapterLocation(supabase, chapterId, studentAppId);
  if (sourceType === "course") {
    return {
      sourceType,
      categorySlug: location.categorySlug,
      subcategorySlug: location.subcategorySlug,
      courseSlug: location.courseSlug,
      lessonSlug: location.lessonSlug,
    };
  }
  if (sourceType === "chapter_practice") {
    return {
      sourceType,
      courseKey: location.courseSlug,
      chapterSlug: location.chapterSlug,
    };
  }
  return {
    sourceType,
    skill,
    courseSlug: location.courseSlug,
    lessonSlug: location.lessonSlug,
    chapterSlug: location.chapterSlug,
  };
}

async function recommendationDto(
  supabase: SupabaseClient,
  row: RecommendationRow,
  space: string,
): Promise<TeacherLearningRecommendation> {
  const sourceLocation = await resolveSourceLocation({
    supabase,
    studentAppId: row.student_app_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetStudentId: row.student_id,
  });
  const target = row.target_scope === "class"
    ? { targetScope: "class" as const, classId: row.class_id! }
    : { targetScope: "student" as const, studentId: row.student_id! };

  return {
    id: row.id,
    studentAppId: row.student_app_id,
    teacherId: row.teacher_id,
    target,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    reason: row.reason,
    isRequired: row.is_required,
    startsAt: row.starts_at,
    dueAt: row.due_at,
    status: row.status,
    href: getTeacherRecommendationPath(space, sourceLocation),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTeacherLearningRecommendation({
  supabase,
  tenantId,
  teacherId,
  space,
  input,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  teacherId: string;
  space: string;
  input: CreateTeacherLearningRecommendationInput;
}): Promise<TeacherLearningRecommendation> {
  const targetStudentId = input.targetScope === "student" ? input.studentId : null;
  await resolveSourceLocation({
    supabase,
    studentAppId: input.studentAppId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetStudentId,
  });

  const startsAt = input.startsAt ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("teacher_learning_recommendations")
    .insert({
      tenant_id: tenantId,
      student_app_id: input.studentAppId,
      teacher_id: teacherId,
      target_scope: input.targetScope,
      class_id: input.targetScope === "class" ? input.classId : null,
      student_id: targetStudentId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      title: input.title.trim(),
      reason: input.reason.trim(),
      is_required: input.isRequired,
      starts_at: startsAt,
      due_at: input.dueAt,
      status: "active",
    })
    .select(RECOMMENDATION_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error("老师推荐创建失败", { cause: error });
  }
  return recommendationDto(supabase, data as RecommendationRow, space);
}

export async function withdrawTeacherLearningRecommendation({
  supabase,
  tenantId,
  teacherId,
  recommendationId,
  space,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  teacherId: string;
  recommendationId: string;
  space: string;
}): Promise<TeacherLearningRecommendation> {
  const { data, error } = await supabase
    .from("teacher_learning_recommendations")
    .update({ status: "withdrawn" })
    .eq("id", recommendationId)
    .eq("tenant_id", tenantId)
    .eq("teacher_id", teacherId)
    .eq("status", "active")
    .gt("starts_at", new Date().toISOString())
    .select(RECOMMENDATION_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    throw new Error("推荐不存在、已开始或无权撤回", { cause: error });
  }
  return recommendationDto(supabase, data as RecommendationRow, space);
}
