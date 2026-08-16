"use server";

import { randomUUID } from "node:crypto";
import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { requirePlatformCourseManager } from "@/lib/admin";
import { assertR2ObjectUpload, createR2SignedUploadUrl, deleteR2Object } from "@/lib/r2";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COVER_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const RESOURCE_MAX_BYTES = 10 * 1024 * 1024;
const RESOURCE_TYPES = new Set(["file", "link", "template", "checklist", "reference"]);

const COURSE_UNLOCK_MODES = new Set([
  "immediate",
  "previous_completed",
  "prerequisite_completed",
  "scheduled",
  "manual",
]);

const LESSON_UNLOCK_MODES = new Set([
  "immediate",
  "previous_completed",
  "prerequisite_completed",
  "prerequisite_passed",
  "scheduled",
  "manual",
]);

const CHAPTER_COMPLETION_RULES = new Set([
  "content_viewed",
  "test_submitted",
  "test_passed",
  "manual",
]);

type CatalogTable = "course_categories" | "courses" | "lessons" | "course_chapters";
type CoverEntityKind = "category" | "course" | "lesson" | "chapter";

const coverTableByKind: Record<CoverEntityKind, CatalogTable> = {
  category: "course_categories",
  course: "courses",
  lesson: "lessons",
  chapter: "course_chapters",
};

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function requiredText(formData: FormData, name: string, label: string) {
  const value = textValue(formData, name);
  if (!value) throw new Error(`${label}不能为空。`);
  return value;
}

function requiredId(formData: FormData, name: string, label: string) {
  const value = requiredText(formData, name, label);
  if (!UUID_PATTERN.test(value)) throw new Error(`${label}格式不正确。`);
  return value;
}

function optionalId(formData: FormData, name: string) {
  const value = textValue(formData, name);
  if (!value) return null;
  if (!UUID_PATTERN.test(value)) throw new Error(`${name} 格式不正确。`);
  return value;
}

function slugValue(formData: FormData) {
  const value = requiredText(formData, "slug", "Slug").toLowerCase();
  if (!SLUG_PATTERN.test(value)) {
    throw new Error("Slug 只能使用小写字母、数字和中划线。");
  }
  return value;
}

function numberValue(formData: FormData, name: string, fallback: number, min: number, max: number) {
  const raw = textValue(formData, name);
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} 必须是 ${min}–${max} 之间的整数。`);
  }
  return value;
}

function optionalDateTime(formData: FormData, name: string) {
  const value = textValue(formData, name);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("开放时间格式不正确。");
  return date.toISOString();
}

function enumValue(formData: FormData, name: string, allowed: Set<string>, fallback: string) {
  const value = textValue(formData, name) || fallback;
  if (!allowed.has(value)) throw new Error(`${name} 取值不正确。`);
  return value;
}

function baseFields(formData: FormData) {
  return {
    title: requiredText(formData, "title", "名称"),
    slug: slugValue(formData),
    description: textValue(formData, "description") || null,
    cover_object_key: textValue(formData, "cover_object_key") || null,
    cover_alt: textValue(formData, "cover_alt") || null,
    cover_focal_point: textValue(formData, "cover_focal_point") || "center",
    is_published: formData.get("is_published") === "on",
    sort_order: numberValue(formData, "sort_order", 0, 0, 100000),
    updated_at: new Date().toISOString(),
  };
}

function revalidateCatalog() {
  revalidateDashboard("/dashboard/admin/courses");
  revalidateDashboard("/dashboard/courses");
}

function lessonMediaFields(formData: FormData) {
  return {
    lesson_type: textValue(formData, "lesson_type") || "video",
    is_free_preview: formData.get("is_free_preview") === "on",
    video_provider: textValue(formData, "video_provider") || null,
    video_url: textValue(formData, "video_url") || null,
    video_object_key: textValue(formData, "video_object_key") || null,
    video_mime_type: textValue(formData, "video_mime_type") || "video/mp4",
  };
}

function lessonBodyFields(formData: FormData) {
  return {
    learning_objectives: textValue(formData, "learning_objectives") || null,
    lesson_tasks: textValue(formData, "lesson_tasks") || null,
    teacher_note: textValue(formData, "teacher_note") || null,
    content_text: textValue(formData, "content_text") || null,
    key_points: textValue(formData, "key_points") || null,
    case_study: textValue(formData, "case_study") || null,
    common_mistakes: textValue(formData, "common_mistakes") || null,
    summary_text: textValue(formData, "summary_text") || null,
    reflection_questions: textValue(formData, "reflection_questions") || null,
    extra_note: textValue(formData, "extra_note") || null,
  };
}

async function assertPlatformRecord(
  supabase: Awaited<ReturnType<typeof requirePlatformCourseManager>>["supabase"],
  table: CatalogTable,
  id: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("id, content_scope")
    .eq("id", id)
    .eq("content_scope", "platform")
    .maybeSingle();

  if (error || !data) throw new Error("找不到可管理的课程目录记录。");
  return data;
}

async function previousCoverKey(
  supabase: Awaited<ReturnType<typeof requirePlatformCourseManager>>["supabase"],
  table: CatalogTable,
  id: string,
) {
  const { data } = await supabase
    .from(table)
    .select("cover_object_key")
    .eq("id", id)
    .maybeSingle();
  return (data?.cover_object_key as string | null | undefined) ?? null;
}

async function removeReplacedCover(previousKey: string | null, nextKey: string | null) {
  if (!previousKey || previousKey === nextKey) return;
  try {
    await deleteR2Object(previousKey);
  } catch {
    // 数据库更新已经成功，R2 的历史孤立对象可由后续清理任务处理。
  }
}

export async function createCourseCategoryAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const parentId = optionalId(formData, "parent_id");
  if (parentId) await assertPlatformRecord(supabase, "course_categories", parentId);
  const studentAppId = parentId
    ? null
    : requiredId(formData, "student_app_id", "所属应用");
  if (
    studentAppId &&
    !new Set(Object.values(STUDENT_APP_IDS)).has(studentAppId)
  ) {
    throw new Error("所属应用不在平台应用注册表中。");
  }

  const { error } = await supabase.from("course_categories").insert({
    ...baseFields(formData),
    parent_id: parentId,
    icon_name: textValue(formData, "icon_name") || "folder",
    accent_color: textValue(formData, "accent_color") || "blue",
    tenant_id: null,
    content_scope: "platform",
    ...(studentAppId ? { student_app_id: studentAppId } : {}),
  });
  if (error) throw new Error(`创建分类失败：${error.message}`);
  revalidateCatalog();
}

export async function updateCourseCategoryAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const id = requiredId(formData, "id", "分类 ID");
  await assertPlatformRecord(supabase, "course_categories", id);
  const previousKey = await previousCoverKey(supabase, "course_categories", id);
  const fields = baseFields(formData);

  const { error } = await supabase
    .from("course_categories")
    .update({
      ...fields,
      icon_name: textValue(formData, "icon_name") || "folder",
      accent_color: textValue(formData, "accent_color") || "blue",
    })
    .eq("id", id);
  if (error) throw new Error(`保存分类失败：${error.message}`);
  await removeReplacedCover(previousKey, fields.cover_object_key);
  revalidateCatalog();
}

export async function createCatalogCourseAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const categoryId = requiredId(formData, "category_id", "所属分类");
  await assertPlatformRecord(supabase, "course_categories", categoryId);

  const { error } = await supabase.from("courses").insert({
    ...baseFields(formData),
    category_id: categoryId,
    level: textValue(formData, "level") || "beginner",
    icon_name: textValue(formData, "icon_name") || "book-open",
    cover_url: textValue(formData, "cover_url") || null,
    unlock_mode: enumValue(formData, "unlock_mode", COURSE_UNLOCK_MODES, "immediate"),
    prerequisite_course_id: optionalId(formData, "prerequisite_course_id"),
    available_from: optionalDateTime(formData, "available_from"),
    is_manually_locked: formData.get("is_manually_locked") === "on",
    tenant_id: null,
    content_scope: "platform",
  });
  if (error) throw new Error(`创建课程失败：${error.message}`);
  revalidateCatalog();
}

export async function updateCatalogCourseAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const id = requiredId(formData, "id", "课程 ID");
  await assertPlatformRecord(supabase, "courses", id);
  const previousKey = await previousCoverKey(supabase, "courses", id);
  const fields = baseFields(formData);

  const { error } = await supabase
    .from("courses")
    .update({
      ...fields,
      level: textValue(formData, "level") || "beginner",
      icon_name: textValue(formData, "icon_name") || "book-open",
      cover_url: textValue(formData, "cover_url") || null,
      unlock_mode: enumValue(formData, "unlock_mode", COURSE_UNLOCK_MODES, "immediate"),
      prerequisite_course_id: optionalId(formData, "prerequisite_course_id"),
      available_from: optionalDateTime(formData, "available_from"),
      is_manually_locked: formData.get("is_manually_locked") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(`保存课程失败：${error.message}`);
  await removeReplacedCover(previousKey, fields.cover_object_key);
  revalidateCatalog();
}

export async function createCatalogLessonAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const courseId = requiredId(formData, "course_id", "所属课程");
  await assertPlatformRecord(supabase, "courses", courseId);

  const { error } = await supabase.from("lessons").insert({
    ...baseFields(formData),
    ...lessonMediaFields(formData),
    ...lessonBodyFields(formData),
    course_id: courseId,
    duration_minutes: numberValue(formData, "duration_minutes", 30, 1, 600),
    unlock_mode: enumValue(formData, "unlock_mode", LESSON_UNLOCK_MODES, "immediate"),
    prerequisite_lesson_id: optionalId(formData, "prerequisite_lesson_id"),
    prerequisite_chapter_id: optionalId(formData, "prerequisite_chapter_id"),
    required_score: numberValue(formData, "required_score", 80, 0, 100),
    available_from: optionalDateTime(formData, "available_from"),
    is_manually_locked: formData.get("is_manually_locked") === "on",
    tenant_id: null,
    content_scope: "platform",
  });
  if (error) throw new Error(`创建课时失败：${error.message}`);
  revalidateCatalog();
}

export async function updateCatalogLessonAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const id = requiredId(formData, "id", "课时 ID");
  await assertPlatformRecord(supabase, "lessons", id);
  const section = textValue(formData, "editor_section") || "all";

  if (section === "content") {
    const { error } = await supabase
      .from("lessons")
      .update({ ...lessonBodyFields(formData), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`保存课时内容失败：${error.message}`);
    revalidateCatalog();
    return;
  }

  if (section === "rules") {
    const { error } = await supabase
      .from("lessons")
      .update({
        unlock_mode: enumValue(formData, "unlock_mode", LESSON_UNLOCK_MODES, "immediate"),
        prerequisite_lesson_id: optionalId(formData, "prerequisite_lesson_id"),
        prerequisite_chapter_id: optionalId(formData, "prerequisite_chapter_id"),
        required_score: numberValue(formData, "required_score", 80, 0, 100),
        available_from: optionalDateTime(formData, "available_from"),
        is_manually_locked: formData.get("is_manually_locked") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`保存课时开放规则失败：${error.message}`);
    revalidateCatalog();
    return;
  }

  const previousKey = await previousCoverKey(supabase, "lessons", id);
  const fields = baseFields(formData);
  const basicOnly = section === "basic";

  const { error } = await supabase
    .from("lessons")
    .update({
      ...fields,
      ...lessonMediaFields(formData),
      ...(!basicOnly ? lessonBodyFields(formData) : {}),
      duration_minutes: numberValue(formData, "duration_minutes", 30, 1, 600),
      ...(!basicOnly ? {
        unlock_mode: enumValue(formData, "unlock_mode", LESSON_UNLOCK_MODES, "immediate"),
        prerequisite_lesson_id: optionalId(formData, "prerequisite_lesson_id"),
        prerequisite_chapter_id: optionalId(formData, "prerequisite_chapter_id"),
        required_score: numberValue(formData, "required_score", 80, 0, 100),
        available_from: optionalDateTime(formData, "available_from"),
        is_manually_locked: formData.get("is_manually_locked") === "on",
      } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(`保存课时失败：${error.message}`);
  await removeReplacedCover(previousKey, fields.cover_object_key);
  revalidateCatalog();
}

export async function createCourseChapterAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const lessonId = requiredId(formData, "lesson_id", "所属课时");
  await assertPlatformRecord(supabase, "lessons", lessonId);

  const { error } = await supabase.from("course_chapters").insert({
    ...baseFields(formData),
    lesson_id: lessonId,
    duration_minutes: numberValue(formData, "duration_minutes", 20, 1, 600),
    completion_rule: enumValue(formData, "completion_rule", CHAPTER_COMPLETION_RULES, "content_viewed"),
    unlock_mode: enumValue(formData, "unlock_mode", LESSON_UNLOCK_MODES, "immediate"),
    prerequisite_chapter_id: optionalId(formData, "prerequisite_chapter_id"),
    required_score: numberValue(formData, "required_score", 80, 0, 100),
    available_from: optionalDateTime(formData, "available_from"),
    is_manually_locked: formData.get("is_manually_locked") === "on",
    tenant_id: null,
    content_scope: "platform",
  });
  if (error) throw new Error(`创建章节失败：${error.message}`);
  revalidateCatalog();
}

export async function updateCourseChapterAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const id = requiredId(formData, "id", "章节 ID");
  await assertPlatformRecord(supabase, "course_chapters", id);
  const previousKey = await previousCoverKey(supabase, "course_chapters", id);
  const fields = baseFields(formData);

  const { error } = await supabase
    .from("course_chapters")
    .update({
      ...fields,
      duration_minutes: numberValue(formData, "duration_minutes", 20, 1, 600),
      completion_rule: enumValue(formData, "completion_rule", CHAPTER_COMPLETION_RULES, "content_viewed"),
      unlock_mode: enumValue(formData, "unlock_mode", LESSON_UNLOCK_MODES, "immediate"),
      prerequisite_chapter_id: optionalId(formData, "prerequisite_chapter_id"),
      required_score: numberValue(formData, "required_score", 80, 0, 100),
      available_from: optionalDateTime(formData, "available_from"),
      is_manually_locked: formData.get("is_manually_locked") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(`保存章节失败：${error.message}`);
  await removeReplacedCover(previousKey, fields.cover_object_key);
  revalidateCatalog();
}

export async function createCourseCoverUploadUrlAction(input: {
  kind: CoverEntityKind;
  entityId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { supabase } = await requirePlatformCourseManager();
  if (!UUID_PATTERN.test(input.entityId)) throw new Error("目录记录 ID 格式不正确。");
  if (!coverTableByKind[input.kind]) throw new Error("不支持该目录类型的配图。");
  if (!COVER_MIME_TYPES.has(input.contentType)) throw new Error("配图仅支持 JPG、PNG 或 WebP。");
  if (!Number.isInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > COVER_MAX_BYTES) {
    throw new Error("配图大小必须在 5MB 以内。");
  }

  await assertPlatformRecord(supabase, coverTableByKind[input.kind], input.entityId);
  const extension = input.contentType === "image/png"
    ? "png"
    : input.contentType === "image/webp"
      ? "webp"
      : "jpg";
  const objectKey = `course-covers/${input.kind}/${input.entityId}/${randomUUID()}.${extension}`;
  const uploadUrl = await createR2SignedUploadUrl(objectKey, input.contentType, input.fileSize);
  return { uploadUrl, objectKey };
}

export async function confirmCourseCoverUploadAction(input: {
  kind: CoverEntityKind;
  entityId: string;
  objectKey: string;
  fileSize: number;
}) {
  const { supabase } = await requirePlatformCourseManager();
  if (!UUID_PATTERN.test(input.entityId)) throw new Error("目录记录 ID 格式不正确。");
  if (!coverTableByKind[input.kind]) throw new Error("不支持该目录类型的配图。");
  if (!Number.isInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > COVER_MAX_BYTES) {
    throw new Error("配图大小必须在 5MB 以内。");
  }
  if (!input.objectKey.startsWith(`course-covers/${input.kind}/${input.entityId}/`)) {
    throw new Error("配图对象路径不正确。");
  }

  await assertPlatformRecord(supabase, coverTableByKind[input.kind], input.entityId);
  await assertR2ObjectUpload(input.objectKey, input.fileSize);
}

export async function createCourseResourceUploadUrlAction(input: {
  lessonId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const { supabase } = await requirePlatformCourseManager();
  if (!UUID_PATTERN.test(input.lessonId)) throw new Error("课时 ID 格式不正确。");
  if (!Number.isInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > RESOURCE_MAX_BYTES) {
    throw new Error("资料文件大小必须在 10MB 以内。");
  }

  await assertPlatformRecord(supabase, "lessons", input.lessonId);
  const extensionMatch = input.fileName.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  const extension = extensionMatch?.[0] ?? "";
  const objectKey = `lesson-resources/${input.lessonId}/${randomUUID()}${extension}`;
  const contentType = input.contentType || "application/octet-stream";
  const uploadUrl = await createR2SignedUploadUrl(objectKey, contentType, input.fileSize);
  return { uploadUrl, objectKey };
}

export async function confirmCourseResourceUploadAction(input: {
  lessonId: string;
  objectKey: string;
  fileSize: number;
}) {
  const { supabase } = await requirePlatformCourseManager();
  if (!UUID_PATTERN.test(input.lessonId)) throw new Error("课时 ID 格式不正确。");
  if (!Number.isInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > RESOURCE_MAX_BYTES) {
    throw new Error("资料文件大小必须在 10MB 以内。");
  }
  if (!input.objectKey.startsWith(`lesson-resources/${input.lessonId}/`)) {
    throw new Error("资料对象路径不正确。");
  }

  await assertPlatformRecord(supabase, "lessons", input.lessonId);
  await assertR2ObjectUpload(input.objectKey, input.fileSize);
}

async function getPlatformResource(
  supabase: Awaited<ReturnType<typeof requirePlatformCourseManager>>["supabase"],
  resourceId: string,
) {
  if (!UUID_PATTERN.test(resourceId)) throw new Error("资料 ID 格式不正确。");
  const { data, error } = await supabase
    .from("lesson_resources")
    .select("id,lesson_id,resource_object_key,original_file_name,is_published,is_deleted,content_scope")
    .eq("id", resourceId)
    .eq("content_scope", "platform")
    .maybeSingle();
  if (error || !data) throw new Error("找不到可管理的课时资料。");
  return data;
}

function resourceFields(formData: FormData) {
  const resourceType = enumValue(formData, "resource_type", RESOURCE_TYPES, "link");
  const resourceUrl = textValue(formData, "resource_url") || null;
  const resourceObjectKey = textValue(formData, "resource_object_key") || null;
  const originalFileName = textValue(formData, "original_file_name") || null;

  if (resourceType === "link" && !resourceUrl) throw new Error("链接资料必须填写 URL。");
  return {
    title: requiredText(formData, "resource_title", "资料名称"),
    description: textValue(formData, "resource_description") || null,
    resource_type: resourceType,
    resource_url: resourceType === "link" ? resourceUrl : null,
    resource_object_key: resourceType === "link" ? null : resourceObjectKey,
    original_file_name: resourceType === "link" ? null : originalFileName,
    is_required: formData.get("resource_is_required") === "on",
    sort_order: numberValue(formData, "resource_sort_order", 0, 0, 100000),
  };
}

export async function createLessonResourceAction(formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const lessonId = requiredId(formData, "lesson_id", "课时 ID");
  await assertPlatformRecord(supabase, "lessons", lessonId);
  const fields = resourceFields(formData);
  if (fields.resource_type !== "link" && !fields.resource_object_key) {
    throw new Error("文件类资料必须先完成上传。");
  }

  const { error } = await supabase.from("lesson_resources").insert({
    ...fields,
    lesson_id: lessonId,
    tenant_id: null,
    content_scope: "platform",
    is_published: true,
    is_deleted: false,
  });
  if (error) throw new Error(`创建课时资料失败：${error.message}`);
  revalidateCatalog();
}

export async function updateLessonResourceAction(resourceId: string, formData: FormData) {
  const { supabase } = await requirePlatformCourseManager();
  const existing = await getPlatformResource(supabase, resourceId);
  await assertPlatformRecord(supabase, "lessons", existing.lesson_id);
  const fields = resourceFields(formData);
  const nextObjectKey = fields.resource_type === "link"
    ? null
    : fields.resource_object_key || existing.resource_object_key;
  const nextFileName = fields.resource_type === "link"
    ? null
    : fields.original_file_name || existing.original_file_name;
  if (fields.resource_type !== "link" && !nextObjectKey) {
    throw new Error("文件类资料必须先完成上传。");
  }

  const { error } = await supabase
    .from("lesson_resources")
    .update({
      ...fields,
      resource_object_key: nextObjectKey,
      original_file_name: nextFileName,
    })
    .eq("id", resourceId);
  if (error) throw new Error(`保存课时资料失败：${error.message}`);
  if (existing.resource_object_key && existing.resource_object_key !== nextObjectKey) {
    try {
      await deleteR2Object(existing.resource_object_key);
    } catch {
      // 数据记录已经切换到新文件，历史对象稍后清理即可。
    }
  }
  revalidateCatalog();
}

export async function setLessonResourcePublishedAction(
  resourceId: string,
  published: boolean,
  _formData: FormData,
) {
  void _formData;
  const { supabase } = await requirePlatformCourseManager();
  const existing = await getPlatformResource(supabase, resourceId);
  await assertPlatformRecord(supabase, "lessons", existing.lesson_id);
  if (existing.is_deleted) throw new Error("回收站中的资料不能直接更改发布状态。");
  const { error } = await supabase
    .from("lesson_resources")
    .update({ is_published: published })
    .eq("id", resourceId);
  if (error) throw new Error(`更新资料状态失败：${error.message}`);
  revalidateCatalog();
}

export async function moveLessonResourceToRecycleBinAction(resourceId: string, formData: FormData) {
  const { supabase, user } = await requirePlatformCourseManager();
  const existing = await getPlatformResource(supabase, resourceId);
  await assertPlatformRecord(supabase, "lessons", existing.lesson_id);
  if (existing.is_published) throw new Error("请先隐藏资料，再移入回收站。");
  const reason = requiredText(formData, "delete_reason", "删除原因");
  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      delete_reason: reason,
    })
    .eq("id", resourceId);
  if (error) throw new Error(`移入回收站失败：${error.message}`);
  revalidateCatalog();
}

export async function restoreLessonResourceFromRecycleBinAction(resourceId: string, _formData: FormData) {
  void _formData;
  const { supabase } = await requirePlatformCourseManager();
  const existing = await getPlatformResource(supabase, resourceId);
  await assertPlatformRecord(supabase, "lessons", existing.lesson_id);
  const { error } = await supabase
    .from("lesson_resources")
    .update({
      is_deleted: false,
      is_published: false,
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    })
    .eq("id", resourceId);
  if (error) throw new Error(`恢复课时资料失败：${error.message}`);
  revalidateCatalog();
}

export async function permanentlyDeleteLessonResourceAction(formData: FormData) {
  const { supabase, globalRole } = await requirePlatformCourseManager();
  if (globalRole !== "platform_owner") throw new Error("只有平台负责人可以彻底删除资料。");
  const resourceId = requiredId(formData, "resource_id", "资料 ID");
  const confirm = textValue(formData, "delete_confirm").toLowerCase();
  if (confirm !== "delete") throw new Error("请输入 delete 确认彻底删除。");
  const existing = await getPlatformResource(supabase, resourceId);
  if (!existing.is_deleted) throw new Error("只有回收站中的资料可以彻底删除。");

  const { error } = await supabase
    .from("lesson_resources")
    .delete()
    .eq("id", resourceId)
    .eq("is_deleted", true);
  if (error) throw new Error(`彻底删除资料失败：${error.message}`);
  if (existing.resource_object_key) {
    try {
      await deleteR2Object(existing.resource_object_key);
    } catch {
      // 数据库记录已经删除，R2 孤立对象可由后续清理任务处理。
    }
  }
  revalidateCatalog();
}
