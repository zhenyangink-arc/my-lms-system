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

    let version = 1;
    if (courseId) {
      const { data } = await supabase
        .from("curriculum_plan_templates")
        .select("version")
        .eq("student_app_id", access.appId)
        .eq("course_id", courseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      version = Number(data?.version ?? 0) + 1;
    }
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
    const customTitle = text(formData, "title");
    let title = customTitle;
    let destinationPath = text(formData, "destination_path");
    let sourceType: "lesson" | "manual" = "manual";
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
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id,slug,category_id,student_app_id,content_scope")
        .eq("id", lesson.course_id)
        .eq("student_app_id", access.appId)
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
      title = customTitle || String(lesson.title);
      destinationPath = `/dashboard/courses/${parent.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`;
      sourceType = "lesson";
      sourceId = String(lesson.id);
    } else {
      if (lessonId) throw new Error("只有课程学习活动可以绑定课时。");
      title = z.string().min(1).max(200).parse(customTitle);
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
      sort_order: day * 10000 + hour * 100 + minute,
    });
    if (error) throw new Error(error.message);
    revalidatePath(path);
    redirect(resultPath(path, "success", "计划项目已加入。"));
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
