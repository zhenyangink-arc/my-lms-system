"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePolicyRequirements } from "./policy-form";

async function owner(space: string, appSlug: string) {
  const access = await requireManagementAppAccess(space, appSlug);
  if (access.scope !== "platform" || access.globalRole !== "platform_owner" || appSlug !== "korean") throw new Error("只有平台负责人可以管理结课政策和刷新任务。");
  return `${access.appPath}/completion-review`;
}

export async function saveCompletionPolicyAction(space: string, appSlug: string, form: FormData) {
  const path = await owner(space, appSlug);
  try {
    const id = form.get("policy_id");
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_completion_policy_draft", {
      p_id: id ? z.string().uuid().parse(id) : null,
      p_course_id: z.string().uuid().parse(form.get("course_id")),
      p_title: z.string().trim().min(2).max(160).parse(form.get("title")),
      p_requirements: parsePolicyRequirements(form),
    });
    if (error) throw new Error(error.message);
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${path}?error=${encodeURIComponent(error instanceof Error ? error.message : "草稿保存失败")}`);
  }
  redirect(`${path}?success=${encodeURIComponent("结课政策草稿已保存，发布后才生效。")}`);
}

export async function publishCompletionPolicyAction(space: string, appSlug: string, id: string) {
  const path = await owner(space, appSlug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_completion_policy_draft", { p_id: z.string().uuid().parse(id) });
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
  redirect(`${path}?success=${encodeURIComponent("新政策已生效，资格重算已进入刷新队列。已有证书保留原颁发快照。")}`);
}

export async function processCompletionRefreshAction(space: string, appSlug: string) {
  const path = await owner(space, appSlug);
  // Server-side worker RPC after explicit owner authorization; no user session is minted.
  const { data, error } = await createAdminClient().rpc("process_course_completion_refresh_tasks", { p_limit: 10 });
  if (error) redirect(`${path}?error=${encodeURIComponent("刷新批次执行失败，请检查服务端任务配置。")}`);
  revalidatePath(path);
  const failed = (data ?? []).reduce((sum: number, task: { failed_count: number }) => sum + Number(task.failed_count), 0);
  redirect(`${path}?${failed ? "error" : "success"}=${encodeURIComponent(failed ? `本批次有 ${failed} 条资格未成功计算，请检查政策和成绩来源。` : `已处理 ${(data ?? []).length} 个到期刷新任务。`)}`);
}

export async function retryCompletionRefreshAction(space: string, appSlug: string) {
  const path = await owner(space, appSlug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retry_failed_completion_refresh");
  if (error) redirect(`${path}?error=${encodeURIComponent("失败任务重新排队失败，请稍后重试。")}`);
  revalidatePath(path);
  redirect(`${path}?success=${encodeURIComponent(`已将 ${Number(data ?? 0)} 个失败任务重新加入队列。`)}`);
}

export async function requestCompletionRefreshAction(space: string, appSlug: string, form: FormData) {
  const access = await requireManagementAppAccess(space, appSlug);
  if (access.scope !== "tenant" || !["tenant_super_admin", "ceo"].includes(access.role) || !access.capabilities.manageAssessments) throw new Error("只有机构负责人可以申请全机构资格重算。");
  const path = `${access.appPath}/completion-review`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_institution_course_completion_refresh", { p_course_id: z.string().uuid().parse(form.get("course_id")), p_student_id: null });
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
  redirect(`${path}?success=${encodeURIComponent("已申请资格重算，后台处理后刷新本页查看。")}`);
}
