"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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


export async function createLessonResourceAction(formData: FormData) {
  const supabase = await createClient();

  const courseId = String(formData.get("course_id") ?? "").trim();
  const lessonId = String(formData.get("lesson_id") ?? "").trim();

  const title = String(formData.get("resource_title") ?? "").trim();
  const descriptionValue = String(
    formData.get("resource_description") ?? ""
  ).trim();
  const resourceUrlValue = String(formData.get("resource_url") ?? "").trim();
  const resourceTypeValue = String(
    formData.get("resource_type") ?? "link"
  ).trim();

  const sortOrderValue = Number(formData.get("resource_sort_order") ?? 0);

  const allowedResourceTypes = [
    "file",
    "link",
    "template",
    "checklist",
    "reference",
  ];

  const resourceType = allowedResourceTypes.includes(resourceTypeValue)
    ? resourceTypeValue
    : "link";

  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!lessonId) {
    throw new Error("Missing lesson_id");
  }

  if (!title || !descriptionValue) {
    /*
      资料标题或资料说明为空时，不新增资料，也不让页面崩溃。
  
      前端已经用 required 做了提示。
      这里是后端兜底，防止有人绕过浏览器直接提交空数据。
    */
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return;
  }

  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: lessonId,
    title,
    description: descriptionValue || null,
    resource_type: resourceType,
    resource_url: resourceUrlValue || null,
    is_required: formData.get("resource_is_required") === "on",
    is_published: true,
    sort_order: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}

export async function hideLessonResourceAction(
  resourceId: string,
  formData: FormData
) {
  const supabase = await createClient();

  /*
    course_id 仍然从当前课时编辑表单里读取。

    为什么 course_id 还要读取？
    因为隐藏资料之后，需要刷新当前管理页面：
    /dashboard/admin/courses/[courseId]
  */
  const courseId = String(formData.get("course_id") ?? "").trim();

  /*
    resourceId 不再从 button 的 name/value 读取。

    原因：
    Next.js Server Action 不允许 button 同时使用：
    1. formAction={某个函数}
    2. name="resource_id"

    所以我们会在 page.tsx 里用：
    hideLessonResourceAction.bind(null, resource.id)

    这样 resource.id 会作为第一个参数传进来。
  */
  if (!courseId) {
    throw new Error("Missing course_id");
  }

  if (!resourceId) {
    throw new Error("Missing resource_id");
  }

  /*
    这里不是真删除资料，而是软隐藏。

    好处：
    1. 数据库里还保留记录
    2. 学生端不会再显示
    3. 后面可以继续做“恢复资料”功能
  */
  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_published: false,
    })
    .eq("id", resourceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}