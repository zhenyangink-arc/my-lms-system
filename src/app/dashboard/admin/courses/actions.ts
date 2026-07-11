"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getNullableString(formData: FormData, name: string) {
  const value = getString(formData, name);

  return value.length > 0 ? value : null;
}

function getNumber(formData: FormData, name: string, fallback = 0) {
  const value = Number(formData.get(name));

  if (Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function getCheckbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function updateCourseAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");

  const title = getString(formData, "title");
  const description = getNullableString(formData, "description");
  const level = getNullableString(formData, "level");
  const isPublished = getCheckbox(formData, "is_published");

  if (!courseId || !title) {
    return;
  }

  await supabase
    .from("courses")
    .update({
      title,
      description,
      level,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

export async function createLessonAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");

  const slug = getString(formData, "slug");
  const title = getString(formData, "title");
  const description = getNullableString(formData, "description");
  const durationMinutes = getNumber(formData, "duration_minutes", 10);
  const sortOrder = getNumber(formData, "sort_order", 1);

  if (!courseId || !slug || !title) {
    return;
  }

  await supabase.from("lessons").insert({
    course_id: courseId,
    slug,
    title,
    description,
    lesson_type: "video",
    duration_minutes: durationMinutes,
    is_free_preview: false,
    is_published: true,
    sort_order: sortOrder,
    video_provider: "r2",
    video_mime_type: "video/mp4",
  });

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

export async function updateLessonAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");
  const lessonId = getString(formData, "lesson_id");

  const slug = getString(formData, "slug");
  const title = getString(formData, "title");
  const description = getNullableString(formData, "description");
  const lessonType = getString(formData, "lesson_type") || "video";
  const durationMinutes = getNumber(formData, "duration_minutes", 10);
  const sortOrder = getNumber(formData, "sort_order", 1);
  const isFreePreview = getCheckbox(formData, "is_free_preview");
  const isPublished = getCheckbox(formData, "is_published");

  const videoProvider = getNullableString(formData, "video_provider");
  const videoObjectKey = getNullableString(formData, "video_object_key");


// 课时内容字段
// 这些字段对应学生端课时学习页面中的学习目标、任务、正文、重点、案例、小结等内容
const learningObjectives = getNullableString(
  formData,
  "learning_objectives"
);
const lessonTasks = getNullableString(formData, "lesson_tasks");
const teacherNote = getNullableString(formData, "teacher_note");

const contentText = getNullableString(formData, "content_text");
const keyPoints = getNullableString(formData, "key_points");
const caseStudy = getNullableString(formData, "case_study");
const commonMistakes = getNullableString(formData, "common_mistakes");

const summaryText = getNullableString(formData, "summary_text");
const reflectionQuestions = getNullableString(
  formData,
  "reflection_questions"
);
const extraNote = getNullableString(formData, "extra_note");

  if (!courseId || !lessonId || !slug || !title) {
    return;
  }

  await supabase
    .from("lessons")
    .update({
      slug,
      title,
      description,
      lesson_type: lessonType,
      duration_minutes: durationMinutes,
      sort_order: sortOrder,
      is_free_preview: isFreePreview,
      is_published: isPublished,
      video_provider: videoProvider,
      video_object_key: videoObjectKey,
      video_mime_type: "video/mp4",
      // 学习引导区
      learning_objectives: learningObjectives,
      lesson_tasks: lessonTasks,
      teacher_note: teacherNote,

      // 核心学习区
      content_text: contentText,
      key_points: keyPoints,
      case_study: caseStudy,
      common_mistakes: commonMistakes,

      // 学习完成区
      summary_text: summaryText,
      reflection_questions: reflectionQuestions,
      extra_note: extraNote,

      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

export async function hideLessonAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const courseId = getString(formData, "course_id");
  const lessonId = getString(formData, "lesson_id");

  if (!courseId || !lessonId) {
    return;
  }

  await supabase
    .from("lessons")
    .update({
      is_published: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}