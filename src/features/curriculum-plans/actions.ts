"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";
import { calculatePlanEnd, seoulLocalInputToISOString } from "./time";
import { TEMPLATE_ITEM_COLUMNS, mapTemplateItem } from "./api/service";

const uuid = z.string().uuid();
const activityType = z.enum([
  "course", "listening", "speaking", "reading", "writing", "vocabulary",
  "grammar", "chapter_test", "stage_exam", "final_exam", "review",
]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "操作失败，请稍后重试。";
}

function resultPath(path: string, kind: "success" | "error", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

async function requirePlatformOwner(space: string, appSlug: string) {
  const access = await requireManagementAppAccess(space, appSlug);
  if (access.scope !== "platform" || access.globalRole !== "platform_owner" || appSlug !== "korean") {
    throw new Error("只有平台负责人可以维护标准学习计划。");
  }
  return access;
}

async function resolveLessonDestinationPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lesson: { course_id: string; slug: string },
  appId: string,
) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,slug,category_id,student_app_id,content_scope")
    .eq("id", lesson.course_id)
    .eq("student_app_id", appId)
    .eq("content_scope", "platform")
    .maybeSingle();
  if (courseError || !course?.category_id) throw new Error("所选课时的课程路径不完整。");
  const { data: subcategory, error: subcategoryError } = await supabase
    .from("course_categories")
    .select("id,slug,parent_id")
    .eq("id", course.category_id)
    .maybeSingle();
  if (subcategoryError || !subcategory?.parent_id) throw new Error("所选课时的课程分类路径不完整。");
  const { data: parent, error: parentError } = await supabase
    .from("course_categories")
    .select("id,slug")
    .eq("id", subcategory.parent_id)
    .maybeSingle();
  if (parentError || !parent) throw new Error("所选课时的上级课程分类不存在。");
  return `/dashboard/courses/${parent.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`;
}

async function nextTemplateVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentAppId: string,
  courseId: string | null,
) {
  let query = supabase
    .from("curriculum_plan_templates")
    .select("version")
    .eq("student_app_id", studentAppId)
    .order("version", { ascending: false })
    .limit(1);
  query = courseId ? query.eq("course_id", courseId) : query.is("course_id", null);
  const { data } = await query.maybeSingle();
  return Number(data?.version ?? 0) + 1;
}

async function requireInstitutionPublisher(space: string, appSlug: string) {
  const access = await requireManagementAppAccess(space, appSlug);
  if (
    access.scope !== "tenant" || !access.tenantId || appSlug !== "korean" ||
    !access.capabilities.manageAssessments ||
    !["teacher", "admin", "ceo", "tenant_super_admin"].includes(access.role)
  ) {
    throw new Error("当前账号没有发布机构学习计划的权限。");
  }
  return access;
}

export async function createCurriculumTemplateAction(
  space: string,
  appSlug: string,
  formData: FormData,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const title = z.string().min(2).max(160).parse(text(formData, "title"));
    const description = z.string().max(1000).parse(text(formData, "description"));
    const durationDays = z.coerce.number().int().min(1).max(366).parse(text(formData, "duration_days"));
    const courseIdValue = text(formData, "course_id");
    const courseId = courseIdValue ? uuid.parse(courseIdValue) : null;
    const supabase = await createClient();

    if (courseId) {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId)
        .eq("student_app_id", access.appId)
        .eq("content_scope", "platform")
        .maybeSingle();
      if (courseError || !course) throw new Error("只能选择当前韩语应用的平台课程。");
    }

    const version = await nextTemplateVersion(supabase, access.appId, courseId);
    const { error } = await supabase.from("curriculum_plan_templates").insert({
      student_app_id: access.appId,
      course_id: courseId,
      title,
      description: description || null,
      duration_days: durationDays,
      version,
      status: "draft",
      created_by: access.userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", "标准学习计划草稿已建立。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function addCurriculumTemplateItemAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
  formData: FormData,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const day = z.coerce.number().int().min(1).max(366).parse(text(formData, "day"));
    const startTime = z.string().regex(/^\d{2}:\d{2}$/).parse(text(formData, "start_time"));
    const [hour, minute] = startTime.split(":").map(Number);
    if (hour < 9 || hour > 23 || minute > 59 || hour === 12 || hour === 18) {
      throw new Error("开始时间需在 09:00–23:59，且避开 12 点和 18 点休息时段。");
    }
    const durationMinutes = z.coerce.number().int().min(5).max(720).parse(text(formData, "duration_minutes"));
    const selectedActivityType = activityType.parse(text(formData, "activity_type"));
    const lessonIdValue = text(formData, "lesson_id");
    const lessonId = lessonIdValue ? uuid.parse(lessonIdValue) : null;
    const chapterTestIdValue = text(formData, "chapter_test_id");
    const chapterTestId = chapterTestIdValue ? uuid.parse(chapterTestIdValue) : null;
    const customTitle = text(formData, "title");
    let title = customTitle;
    let destinationPath = text(formData, "destination_path");
    let sourceType: "lesson" | "chapter_test" | "manual" = "manual";
    let sourceId: string | null = null;
    if (destinationPath && !destinationPath.startsWith("/")) throw new Error("学习入口必须以 / 开头。");
    const supabase = await createClient();
    const { data: template, error: templateError } = await supabase
      .from("curriculum_plan_templates")
      .select("id,duration_days,status,student_app_id,course_id")
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .single();
    if (templateError || !template || template.status !== "draft") throw new Error("只能编辑当前应用的草稿计划。");
    if (day > Number(template.duration_days)) throw new Error(`该计划只有 ${template.duration_days} 天。`);
    if (selectedActivityType === "course") {
      if (!lessonId || !template.course_id) throw new Error("课程学习必须绑定该计划课程中的真实课时。");
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id,course_id,title,slug,is_published")
        .eq("id", lessonId)
        .eq("course_id", template.course_id)
        .eq("is_published", true)
        .maybeSingle();
      if (lessonError || !lesson) throw new Error("所选课时不存在、未发布或不属于该计划课程。");
      title = customTitle || String(lesson.title);
      destinationPath = await resolveLessonDestinationPath(supabase, lesson, access.appId);
      sourceType = "lesson";
      sourceId = String(lesson.id);
    } else if (selectedActivityType === "chapter_test") {
      if (!chapterTestId || !template.course_id) throw new Error("章节测试必须绑定该计划课程中的真实测试。");
      const { data: chapterTest, error: chapterTestError } = await supabase
        .from("chapter_tests")
        .select("id,slug,title,lesson_id,status")
        .eq("id", chapterTestId)
        .eq("student_app_id", access.appId)
        .eq("status", "published")
        .maybeSingle();
      if (chapterTestError || !chapterTest) throw new Error("所选测试不存在或未发布。");
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id,course_id,slug,is_published")
        .eq("id", chapterTest.lesson_id)
        .eq("course_id", template.course_id)
        .eq("is_published", true)
        .maybeSingle();
      if (lessonError || !lesson) throw new Error("所选测试所属课时不属于该计划课程或未发布。");
      title = customTitle || String(chapterTest.title);
      const lessonPath = await resolveLessonDestinationPath(supabase, lesson, access.appId);
      destinationPath = `${lessonPath}?chapter=${chapterTest.slug}`;
      sourceType = "chapter_test";
      sourceId = String(chapterTest.id);
    } else {
      if (lessonId || chapterTestId) throw new Error("只有课程学习或章节测试活动可以绑定真实内容。");
      title = z.string().min(1).max(200).parse(customTitle);
    }
    const newStart = hour * 60 + minute;
    const newEnd = newStart + durationMinutes;
    const { data: sameDayItems, error: sameDayError } = await supabase
      .from("curriculum_plan_template_items")
      .select("title,start_minute,duration_minutes")
      .eq("template_id", templateId)
      .eq("day_offset", day - 1);
    if (sameDayError) throw new Error(sameDayError.message);
    const conflict = (sameDayItems ?? []).find((row) => {
      const existingStart = Number(row.start_minute);
      const existingEnd = existingStart + Number(row.duration_minutes);
      return newStart < existingEnd && existingStart < newEnd;
    });
    if (conflict) {
      throw new Error(`第 ${day} 天 ${startTime} 与「${conflict.title}」的时间段冲突，请调整开始时间或时长。`);
    }
    const { error } = await supabase.from("curriculum_plan_template_items").insert({
      template_id: templateId,
      day_offset: day - 1,
      start_minute: hour * 60 + minute,
      duration_minutes: durationMinutes,
      activity_type: selectedActivityType,
      source_type: sourceType,
      source_id: sourceId,
      title,
      destination_path: destinationPath || null,
      instructions: text(formData, "instructions") || null,
      is_required: formData.get("is_required") === "on",
      sort_order: hour * 100 + minute,
    });
    if (error) throw new Error(error.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", "计划项目已加入。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function updateCurriculumTemplateItemAction(
  space: string,
  appSlug: string,
  itemIdValue: string,
  formData: FormData,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const itemId = uuid.parse(itemIdValue);
    const day = z.coerce.number().int().min(1).max(366).parse(text(formData, "day"));
    const startTime = z.string().regex(/^\d{2}:\d{2}$/).parse(text(formData, "start_time"));
    const [hour, minute] = startTime.split(":").map(Number);
    if (hour < 9 || hour > 23 || minute > 59 || hour === 12 || hour === 18) {
      throw new Error("开始时间需在 09:00–23:59，且避开 12 点和 18 点休息时段。");
    }
    const durationMinutes = z.coerce.number().int().min(5).max(720).parse(text(formData, "duration_minutes"));
    const instructions = text(formData, "instructions");
    const isRequired = formData.get("is_required") === "on";
    const supabase = await createClient();

    const { data: item, error: itemError } = await supabase
      .from("curriculum_plan_template_items")
      .select("id,template_id,title,curriculum_plan_templates!inner(id,duration_days,status,student_app_id)")
      .eq("id", itemId)
      .eq("curriculum_plan_templates.student_app_id", access.appId)
      .maybeSingle();
    if (itemError || !item) throw new Error("找不到要修改的计划项目。");
    const template = Array.isArray(item.curriculum_plan_templates)
      ? item.curriculum_plan_templates[0]
      : item.curriculum_plan_templates;
    if (!template || template.status !== "draft") throw new Error("只能修改当前应用草稿计划里的项目。");
    if (day > Number(template.duration_days)) throw new Error(`该计划只有 ${template.duration_days} 天。`);

    const newStart = hour * 60 + minute;
    const newEnd = newStart + durationMinutes;
    const { data: sameDayItems, error: sameDayError } = await supabase
      .from("curriculum_plan_template_items")
      .select("id,title,start_minute,duration_minutes")
      .eq("template_id", template.id)
      .eq("day_offset", day - 1)
      .neq("id", itemId);
    if (sameDayError) throw new Error(sameDayError.message);
    const conflict = (sameDayItems ?? []).find((row) => {
      const existingStart = Number(row.start_minute);
      const existingEnd = existingStart + Number(row.duration_minutes);
      return newStart < existingEnd && existingStart < newEnd;
    });
    if (conflict) {
      throw new Error(`第 ${day} 天 ${startTime} 与「${conflict.title}」的时间段冲突，请调整开始时间或时长。`);
    }

    const { error } = await supabase
      .from("curriculum_plan_template_items")
      .update({
        day_offset: day - 1,
        start_minute: newStart,
        duration_minutes: durationMinutes,
        instructions: instructions || null,
        is_required: isRequired,
        sort_order: hour * 100 + minute,
      })
      .eq("id", itemId);
    if (error) throw new Error(error.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", "计划项目已更新。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function deleteCurriculumTemplateItemAction(
  space: string,
  appSlug: string,
  itemIdValue: string,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const itemId = uuid.parse(itemIdValue);
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from("curriculum_plan_template_items")
      .select("id,curriculum_plan_templates!inner(id,status,student_app_id)")
      .eq("id", itemId)
      .eq("curriculum_plan_templates.student_app_id", access.appId)
      .maybeSingle();
    if (itemError || !item) throw new Error("找不到要删除的计划项目。");
    const template = Array.isArray(item.curriculum_plan_templates)
      ? item.curriculum_plan_templates[0]
      : item.curriculum_plan_templates;
    if (!template || template.status !== "draft") throw new Error("只能删除当前应用草稿计划里的项目。");
    const { error } = await supabase.from("curriculum_plan_template_items").delete().eq("id", itemId);
    if (error) throw new Error(error.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", "计划项目已删除。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function publishCurriculumTemplateAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const supabase = await createClient();
    const { count, error: countError } = await supabase
      .from("curriculum_plan_template_items")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId);
    if (countError || !count) throw new Error("至少添加一个计划项目后才能发布。");
    const { data: publishedTemplate, error } = await supabase
      .from("curriculum_plan_templates")
      .update({ status: "published", published_by: access.userId, published_at: new Date().toISOString() })
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!publishedTemplate) throw new Error("该草稿不存在或已被其他人发布，请刷新页面。");
    revalidatePath(path);
    redirect(resultPath(path, "success", "标准计划已发布，机构现在可以采用。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function publishInstitutionCurriculumPlanAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
  formData: FormData,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requireInstitutionPublisher(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const studentIds = [...new Set(formData.getAll("student_ids").map(String))].map((id) => uuid.parse(id));
    if (studentIds.length === 0) throw new Error("请至少选择一名学生。");
    const startsAt = new Date(seoulLocalInputToISOString(text(formData, "starts_at")));
    const supabase = await createClient();
    const [{ data: template, error: templateError }, { data: itemRows, error: itemError }] = await Promise.all([
      supabase.from("curriculum_plan_templates").select("id,title,status,student_app_id").eq("id", templateId).single(),
      supabase.from("curriculum_plan_template_items").select(TEMPLATE_ITEM_COLUMNS).eq("template_id", templateId),
    ]);
    if (templateError || !template || template.status !== "published" || template.student_app_id !== access.appId) {
      throw new Error("该平台标准计划尚未发布或不属于当前应用。");
    }
    if (itemError || !itemRows?.length) throw new Error("该标准计划还没有可发布的明细。");
    const items = itemRows.map((row) => mapTemplateItem(row as never));
    const endsAt = calculatePlanEnd(startsAt, items);

    const enrollmentQuery = await supabase
      .from("student_app_enrollments")
      .select("student_id")
      .eq("tenant_id", access.tenantId!)
      .eq("app_id", access.appId)
      .eq("status", "active")
      .in("student_id", studentIds);
    if (enrollmentQuery.error || enrollmentQuery.data?.length !== studentIds.length) throw new Error("所选学生中包含未开通本应用的账号。");
    if (access.role === "teacher") {
      const { data, error } = await supabase
        .from("tenant_student_assignments")
        .select("student_id")
        .eq("tenant_id", access.tenantId!)
        .eq("teacher_id", access.userId)
        .in("student_id", studentIds);
      if (error || data?.length !== studentIds.length) throw new Error("老师只能向自己负责的学生发布计划。");
    }
    const title = z.string().min(1).max(180).parse(text(formData, "title") || template.title);
    const { error: publishError } = await supabase.rpc("publish_institution_curriculum_plan", {
      p_student_app_id: access.appId,
      p_template_id: templateId,
      p_title: title,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_student_ids: studentIds,
    });
    if (publishError) throw new Error(publishError.message);
    revalidatePath(path);
    revalidatePath(`/${space}/apps/korean`);
    redirect(resultPath(path, "success", "机构学习计划已发布，学生端会按实际日期显示。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function duplicateCurriculumTemplateAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const supabase = await createClient();
    const { data: source, error: sourceError } = await supabase
      .from("curriculum_plan_templates")
      .select("id,student_app_id,course_id,title,description,duration_days")
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .single();
    if (sourceError || !source) throw new Error("找不到要复制的标准计划。");
    const { data: sourceItemRows, error: itemsError } = await supabase
      .from("curriculum_plan_template_items")
      .select(TEMPLATE_ITEM_COLUMNS)
      .eq("template_id", templateId);
    if (itemsError) throw new Error("复制计划明细失败。", { cause: itemsError });

    const version = await nextTemplateVersion(supabase, access.appId, source.course_id);
    const { data: newTemplate, error: insertError } = await supabase
      .from("curriculum_plan_templates")
      .insert({
        student_app_id: source.student_app_id,
        course_id: source.course_id,
        title: source.title,
        description: source.description,
        duration_days: source.duration_days,
        version,
        status: "draft",
        created_by: access.userId,
      })
      .select("id")
      .single();
    if (insertError || !newTemplate) throw new Error("创建新草稿失败。", { cause: insertError });

    const sourceItems = (sourceItemRows ?? []).map((row) => mapTemplateItem(row as never));
    if (sourceItems.length) {
      const { error: copyError } = await supabase.from("curriculum_plan_template_items").insert(
        sourceItems.map((item) => ({
          template_id: newTemplate.id,
          day_offset: item.dayOffset,
          start_minute: item.startMinute,
          duration_minutes: item.durationMinutes,
          activity_type: item.activityType,
          source_type: item.sourceType,
          source_id: item.sourceId,
          title: item.title,
          destination_path: item.destinationPath,
          instructions: item.instructions,
          is_required: item.isRequired,
          sort_order: item.sortOrder,
        })),
      );
      if (copyError) throw new Error("复制计划明细失败。", { cause: copyError });
    }
    revalidatePath(path);
    redirect(resultPath(path, "success", "已复制为新草稿，可继续编辑后再发布。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function deleteCurriculumTemplateAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const supabase = await createClient();
    const { data: template, error: templateError } = await supabase
      .from("curriculum_plan_templates")
      .select("id,status")
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .maybeSingle();
    if (templateError || !template) throw new Error("找不到要删除的标准计划。");
    if (template.status !== "draft") throw new Error("已发布或停用的标准计划不能删除，请改为复制成新草稿。");
    const { error: itemsError } = await supabase
      .from("curriculum_plan_template_items")
      .delete()
      .eq("template_id", templateId);
    if (itemsError) throw new Error(itemsError.message);
    const { error: deleteError } = await supabase
      .from("curriculum_plan_templates")
      .delete()
      .eq("id", templateId)
      .eq("status", "draft");
    if (deleteError) throw new Error(deleteError.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", "草稿已删除。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function retireCurriculumTemplateAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const supabase = await createClient();
    const { data: retired, error } = await supabase
      .from("curriculum_plan_templates")
      .update({ status: "retired" })
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .eq("status", "published")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!retired) throw new Error("该计划不是已发布状态，无法停用。");
    revalidatePath(path);
    redirect(resultPath(path, "success", "标准计划已停用，机构无法再采用，已发布给学生的机构计划不受影响。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function cancelInstitutionPlanAction(
  space: string,
  appSlug: string,
  planIdValue: string,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requireInstitutionPublisher(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const planId = uuid.parse(planIdValue);
    const supabase = await createClient();
    let query = supabase
      .from("institution_curriculum_plans")
      .update({ status: "cancelled" })
      .eq("id", planId)
      .eq("tenant_id", access.tenantId!)
      .eq("student_app_id", access.appId)
      .in("status", ["published", "active"]);
    if (access.role === "teacher") query = query.eq("created_by", access.userId);
    const { data: cancelled, error } = await query.select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!cancelled) throw new Error("找不到该计划，或它已经结束、不属于你。");
    revalidatePath(path);
    revalidatePath(`/${space}/apps/korean`);
    redirect(resultPath(path, "success", "机构计划已取消，学生端不会再显示本计划。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function generateChapterScheduleAction(
  space: string,
  appSlug: string,
  templateIdValue: string,
  formData: FormData,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requirePlatformOwner(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const templateId = uuid.parse(templateIdValue);
    const lessonId = uuid.parse(text(formData, "lesson_id"));
    const startDay = z.coerce.number().int().min(1).max(366).parse(text(formData, "start_day"));
    const intervalDays = z.coerce.number().int().min(1).max(30).parse(text(formData, "interval_days"));
    const startTime = z.string().regex(/^\d{2}:\d{2}$/).parse(text(formData, "start_time"));
    const [hour, minute] = startTime.split(":").map(Number);
    if (hour < 9 || hour > 23 || minute > 59 || hour === 12 || hour === 18) {
      throw new Error("开始时间需在 09:00–23:59，且避开 12 点和 18 点休息时段。");
    }
    const durationMinutes = z.coerce.number().int().min(5).max(720).parse(text(formData, "duration_minutes"));
    const isRequired = formData.get("is_required") === "on";
    const supabase = await createClient();

    const { data: template, error: templateError } = await supabase
      .from("curriculum_plan_templates")
      .select("id,duration_days,status,student_app_id,course_id")
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .single();
    if (templateError || !template || template.status !== "draft") throw new Error("只能编辑当前应用的草稿计划。");
    if (!template.course_id) throw new Error("请先给标准计划绑定课程，再批量生成章节。");

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id,course_id,slug,is_published")
      .eq("id", lessonId)
      .eq("course_id", template.course_id)
      .eq("is_published", true)
      .maybeSingle();
    if (lessonError || !lesson) throw new Error("所选课时不存在、未发布或不属于该计划课程。");

    const { data: chapterRows, error: chapterError } = await supabase
      .from("course_chapters")
      .select("id,slug,title")
      .eq("lesson_id", lesson.id)
      .eq("is_published", true)
      .order("sort_order");
    if (chapterError) throw new Error(chapterError.message);
    const chapters = (chapterRows ?? []).filter((chapter) => !String(chapter.slug).endsWith("-00"));
    if (chapters.length === 0) throw new Error("该课时没有可用于排课的正式章节。");

    const lastDay = startDay + (chapters.length - 1) * intervalDays;
    if (lastDay > Number(template.duration_days)) {
      throw new Error(
        `${chapters.length} 章按每 ${intervalDays} 天一章、从第 ${startDay} 天开始排，会排到第 ${lastDay} 天，超出计划总天数（${template.duration_days} 天）。请调整起始天数、间隔天数，或把计划总天数改大后重试。`,
      );
    }

    const destinationPath = await resolveLessonDestinationPath(supabase, lesson, access.appId);
    const newStart = hour * 60 + minute;
    const newEnd = newStart + durationMinutes;
    const dayOffsets = chapters.map((_, index) => startDay - 1 + index * intervalDays);

    const { data: existingItems, error: existingError } = await supabase
      .from("curriculum_plan_template_items")
      .select("title,day_offset,start_minute,duration_minutes")
      .eq("template_id", templateId)
      .in("day_offset", dayOffsets);
    if (existingError) throw new Error(existingError.message);
    const conflict = (existingItems ?? []).find((row) => {
      const existingStart = Number(row.start_minute);
      const existingEnd = existingStart + Number(row.duration_minutes);
      return newStart < existingEnd && existingStart < newEnd;
    });
    if (conflict) {
      throw new Error(`第 ${Number(conflict.day_offset) + 1} 天与「${conflict.title}」的时间段冲突，请调整开始时间或时长后重试。`);
    }

    const { error: insertError } = await supabase.from("curriculum_plan_template_items").insert(
      chapters.map((chapter, index) => {
        const dayOffset = startDay - 1 + index * intervalDays;
        return {
          template_id: templateId,
          day_offset: dayOffset,
          start_minute: newStart,
          duration_minutes: durationMinutes,
          activity_type: "course",
          source_type: "chapter",
          source_id: chapter.id,
          title: chapter.title,
          destination_path: `${destinationPath}?chapter=${chapter.slug}`,
          instructions: null,
          is_required: isRequired,
          sort_order: hour * 100 + minute,
        };
      }),
    );
    if (insertError) throw new Error(insertError.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", `已按每 ${intervalDays} 天一章生成 ${chapters.length} 项课程安排。`));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}

export async function addStudentsToInstitutionPlanAction(
  space: string,
  appSlug: string,
  planIdValue: string,
  formData: FormData,
) {
  let path = `/${space}/dashboard/admin/apps/${appSlug}/learning-plans`;
  try {
    const access = await requireInstitutionPublisher(space, appSlug);
    path = `${access.appPath}/learning-plans`;
    const planId = uuid.parse(planIdValue);
    const studentIds = [...new Set(formData.getAll("student_ids").map(String))].map((id) => uuid.parse(id));
    if (studentIds.length === 0) throw new Error("请至少选择一名要追加的学生。");
    const supabase = await createClient();
    const { data: plan, error: planError } = await supabase
      .from("institution_curriculum_plans")
      .select("id,status,created_by")
      .eq("id", planId)
      .eq("tenant_id", access.tenantId!)
      .eq("student_app_id", access.appId)
      .single();
    if (planError || !plan) throw new Error("找不到该机构学习计划。");
    if (!["published", "active"].includes(plan.status)) throw new Error("该计划已结束或尚未发布，无法追加学生。");
    if (access.role === "teacher" && plan.created_by !== access.userId) {
      throw new Error("只能向自己发布的计划追加学生。");
    }
    const enrollmentQuery = await supabase
      .from("student_app_enrollments")
      .select("student_id")
      .eq("tenant_id", access.tenantId!)
      .eq("app_id", access.appId)
      .eq("status", "active")
      .in("student_id", studentIds);
    if (enrollmentQuery.error || enrollmentQuery.data?.length !== studentIds.length) {
      throw new Error("所选学生中包含未开通本应用的账号。");
    }
    if (access.role === "teacher") {
      const { data, error } = await supabase
        .from("tenant_student_assignments")
        .select("student_id")
        .eq("tenant_id", access.tenantId!)
        .eq("teacher_id", access.userId)
        .in("student_id", studentIds);
      if (error || data?.length !== studentIds.length) throw new Error("老师只能向自己负责的学生发布计划。");
    }
    const { error: insertError } = await supabase.from("institution_curriculum_plan_students").upsert(
      studentIds.map((studentId) => ({
        plan_id: planId,
        tenant_id: access.tenantId!,
        student_id: studentId,
        assigned_by: access.userId,
      })),
      { onConflict: "plan_id,student_id", ignoreDuplicates: true },
    );
    if (insertError) throw new Error(insertError.message);
    revalidatePath(path);
    revalidatePath(`/${space}/apps/korean`);
    redirect(resultPath(path, "success", "已追加学生，对方下次进入学习首页即可看到本计划。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}
