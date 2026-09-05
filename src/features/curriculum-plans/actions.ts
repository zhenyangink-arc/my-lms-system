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
    const durationMinutes = z.coerce.number().int().min(5).max(720).parse(text(formData, "duration_minutes"));
    const title = z.string().min(1).max(200).parse(text(formData, "title"));
    const destinationPath = text(formData, "destination_path");
    if (destinationPath && !destinationPath.startsWith("/")) throw new Error("学习入口必须以 / 开头。");
    const supabase = await createClient();
    const { data: template, error: templateError } = await supabase
      .from("curriculum_plan_templates")
      .select("id,duration_days,status,student_app_id")
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .single();
    if (templateError || !template || template.status !== "draft") throw new Error("只能编辑当前应用的草稿计划。");
    if (day > Number(template.duration_days)) throw new Error(`该计划只有 ${template.duration_days} 天。`);
    const { error } = await supabase.from("curriculum_plan_template_items").insert({
      template_id: templateId,
      day_offset: day - 1,
      start_minute: hour * 60 + minute,
      duration_minutes: durationMinutes,
      activity_type: activityType.parse(text(formData, "activity_type")),
      source_type: "manual",
      source_id: null,
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
    const { error } = await supabase
      .from("curriculum_plan_templates")
      .update({ status: "published", published_by: access.userId, published_at: new Date().toISOString() })
      .eq("id", templateId)
      .eq("student_app_id", access.appId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
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
    const publishedAt = new Date().toISOString();
    const title = text(formData, "title") || template.title;
    const { data: plan, error: planError } = await supabase
      .from("institution_curriculum_plans")
      .insert({
        tenant_id: access.tenantId!, student_app_id: access.appId, template_id: templateId,
        title, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: "published",
        created_by: access.userId, published_by: access.userId, published_at: publishedAt,
      })
      .select("id")
      .single();
    if (planError || !plan) throw new Error(planError?.message ?? "机构计划创建失败。");
    const { error: assignmentError } = await supabase.from("institution_curriculum_plan_students").insert(
      studentIds.map((studentId) => ({ plan_id: plan.id, tenant_id: access.tenantId!, student_id: studentId, assigned_by: access.userId })),
    );
    if (assignmentError) {
      await supabase.from("institution_curriculum_plans").delete().eq("id", plan.id);
      throw new Error(assignmentError.message);
    }
    revalidatePath(path);
    revalidatePath(`/${space}/apps/korean`);
    redirect(resultPath(path, "success", "机构学习计划已发布，学生端会按实际日期显示。"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(resultPath(path, "error", errorMessage(error)));
  }
}
