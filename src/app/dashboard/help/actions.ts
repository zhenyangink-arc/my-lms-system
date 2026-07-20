"use server";

import { revalidatePath } from "next/cache";

import { getHelpCenterAccess, requireHelpCenterManager } from "@/lib/help-center";
import type { HelpCenterActionState } from "./action-state";
import {
  HELP_ARTICLE_CATEGORIES,
  HELP_ARTICLE_STATUSES,
  HELP_TICKET_CATEGORIES,
  HELP_TICKET_PRIORITIES,
  HELP_TICKET_STATUSES,
  type HelpArticleCategory,
  type HelpArticleStatus,
  type HelpTicketCategory,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "./config";

function result(status: "success" | "error", message: string): HelpCenterActionState { return { status, message }; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

function refreshHelp(ticketId?: string) {
  revalidatePath("/dashboard/help");
  revalidatePath("/dashboard/admin/help");
  revalidatePath("/dashboard/admin");
  if (ticketId) {
    revalidatePath(`/dashboard/help/tickets/${ticketId}`);
    revalidatePath(`/dashboard/admin/help/tickets/${ticketId}`);
  }
}

function readArticle(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "platform");
  const sortOrder = Number.parseInt(String(formData.get("sort_order") ?? "0"), 10);
  if (title.length < 2 || title.length > 120) return { error: "文章标题需要填写 2 至 120 个字。" } as const;
  if (summary.length > 500) return { error: "文章摘要不能超过 500 个字。" } as const;
  if (content.length < 2 || content.length > 10000) return { error: "文章正文需要填写 2 至 10000 个字。" } as const;
  if (!(HELP_ARTICLE_CATEGORIES as readonly string[]).includes(category)) return { error: "请选择有效的文章分类。" } as const;
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return { error: "排序值需要填写 0 至 100000。" } as const;
  return { data: { p_title: title, p_summary: summary, p_content: content, p_category: category as HelpArticleCategory, p_is_featured: formData.get("is_featured") === "on", p_sort_order: sortOrder } } as const;
}

export async function createHelpArticleAction(_state: HelpCenterActionState, formData: FormData): Promise<HelpCenterActionState> {
  void _state;
  const { supabase } = await requireHelpCenterManager();
  const input = readArticle(formData);
  if ("error" in input && input.error) return result("error", input.error);
  const status: HelpArticleStatus = formData.get("intent") === "publish" ? "published" : "draft";
  const { error } = await supabase.rpc("save_help_article", { p_id: null, ...input.data, p_status: status });
  if (error) return result("error", "帮助文章保存失败，请稍后重试。");
  refreshHelp();
  return result("success", status === "published" ? "帮助文章已经发布。" : "帮助文章草稿已经保存。");
}

export async function updateHelpArticleAction(articleId: string, _state: HelpCenterActionState, formData: FormData): Promise<HelpCenterActionState> {
  void _state;
  if (!isUuid(articleId)) return result("error", "文章编号不正确。");
  const { supabase } = await requireHelpCenterManager();
  const input = readArticle(formData);
  if ("error" in input && input.error) return result("error", input.error);
  const status = String(formData.get("status") ?? "draft");
  if (!(HELP_ARTICLE_STATUSES as readonly string[]).includes(status)) return result("error", "文章状态不正确。");
  const { error } = await supabase.rpc("save_help_article", { p_id: articleId, ...input.data, p_status: status as HelpArticleStatus });
  if (error) return result("error", "帮助文章修改失败，请稍后重试。");
  refreshHelp();
  return result("success", "帮助文章内容已经更新。");
}

export async function changeHelpArticleStatusAction(articleId: string, nextStatus: HelpArticleStatus, _state: HelpCenterActionState, _formData: FormData): Promise<HelpCenterActionState> {
  void _state; void _formData;
  if (!isUuid(articleId) || !(HELP_ARTICLE_STATUSES as readonly string[]).includes(nextStatus)) return result("error", "文章编号或状态不正确。");
  const { supabase } = await requireHelpCenterManager();
  const { error } = await supabase.rpc("change_help_article_status", { p_article_id: articleId, p_status: nextStatus });
  if (error) return result("error", "文章状态更新失败。");
  refreshHelp();
  return result("success", nextStatus === "published" ? "文章已经发布。" : nextStatus === "archived" ? "文章已经归档。" : "文章已经转为草稿。");
}

export async function createHelpTicketAction(_state: HelpCenterActionState, formData: FormData): Promise<HelpCenterActionState> {
  void _state;
  const access = await getHelpCenterAccess();
  if (access.role !== "student") return result("error", "当前是后台预览账号，不能提交学生求助。");
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const priority = String(formData.get("priority") ?? "normal");
  if (subject.length < 2 || subject.length > 120) return result("error", "求助标题需要填写 2 至 120 个字。");
  if (description.length < 2 || description.length > 5000) return result("error", "请用 2 至 5000 个字描述遇到的问题。");
  if (!(HELP_TICKET_CATEGORIES as readonly string[]).includes(category)) return result("error", "请选择有效的问题分类。");
  if (!(HELP_TICKET_PRIORITIES as readonly string[]).includes(priority)) return result("error", "请选择有效的紧急程度。");
  const { data, error } = await access.supabase.rpc("create_help_ticket", { p_subject: subject, p_description: description, p_category: category as HelpTicketCategory, p_priority: priority as HelpTicketPriority });
  if (error || !data) return result("error", "求助提交失败，请稍后重试。");
  refreshHelp(String(data));
  return result("success", "求助已经提交，处理进度会显示在下方记录中。");
}

export async function replyHelpTicketAction(ticketId: string, _state: HelpCenterActionState, formData: FormData): Promise<HelpCenterActionState> {
  void _state;
  if (!isUuid(ticketId)) return result("error", "求助编号不正确。");
  const access = await getHelpCenterAccess();
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 5000) return result("error", "回复内容需要填写 1 至 5000 个字。");
  const { error } = await access.supabase.rpc("add_help_ticket_message", { p_ticket_id: ticketId, p_body: body });
  if (error) return result("error", "回复发送失败，请确认求助仍然开放。");
  refreshHelp(ticketId);
  return result("success", "回复已经发送。");
}

export async function updateHelpTicketAction(ticketId: string, _state: HelpCenterActionState, formData: FormData): Promise<HelpCenterActionState> {
  void _state;
  if (!isUuid(ticketId)) return result("error", "求助编号不正确。");
  const { supabase } = await requireHelpCenterManager();
  const status = String(formData.get("status") ?? "open");
  const priority = String(formData.get("priority") ?? "normal");
  const resolution = String(formData.get("resolution") ?? "").trim();
  if (!(HELP_TICKET_STATUSES as readonly string[]).includes(status)) return result("error", "请选择有效的处理状态。");
  if (!(HELP_TICKET_PRIORITIES as readonly string[]).includes(priority)) return result("error", "请选择有效的紧急程度。");
  if (resolution.length > 3000) return result("error", "处理结果不能超过 3000 个字。");
  const { error } = await supabase.rpc("update_help_ticket", { p_ticket_id: ticketId, p_status: status as HelpTicketStatus, p_priority: priority as HelpTicketPriority, p_resolution: resolution });
  if (error) return result("error", "求助处理状态保存失败。");
  refreshHelp(ticketId);
  return result("success", "求助处理状态已经更新。");
}

export async function grantHelpCenterAdminAction(_state: HelpCenterActionState, formData: FormData): Promise<HelpCenterActionState> {
  void _state;
  const access = await getHelpCenterAccess();
  if (!access.canAssignAdmins) return result("error", "只有负责人可以指定帮助中心管理员。");
  const adminId = String(formData.get("admin_id") ?? "");
  if (!isUuid(adminId)) return result("error", "请选择需要授权的管理员。");
  const { data: target, error: targetError } = await access.supabase.from("profiles").select("id,role,status").eq("id", adminId).maybeSingle();
  if (targetError || !target || target.role !== "admin" || (target.status && target.status !== "active")) return result("error", "只能授权状态正常的管理员账号。");
  const { error } = await access.supabase.from("help_center_admin_assignments").upsert({ admin_id: adminId, granted_by: access.user.id, granted_at: new Date().toISOString(), revoked_by: null, revoked_at: null }, { onConflict: "tenant_id,admin_id" });
  if (error) return result("error", "管理员授权失败。");
  refreshHelp();
  return result("success", "该管理员已经获得帮助中心后台权限。");
}

export async function revokeHelpCenterAdminAction(adminId: string, _state: HelpCenterActionState, _formData: FormData): Promise<HelpCenterActionState> {
  void _state; void _formData;
  const access = await getHelpCenterAccess();
  if (!access.canAssignAdmins) return result("error", "只有负责人可以撤销帮助中心管理员权限。");
  if (!isUuid(adminId)) return result("error", "管理员编号不正确。");
  const { data, error } = await access.supabase.from("help_center_admin_assignments").update({ revoked_by: access.user.id, revoked_at: new Date().toISOString() }).eq("admin_id", adminId).is("revoked_at", null).select("admin_id").maybeSingle();
  if (error || !data) return result("error", "管理员权限撤销失败。");
  refreshHelp();
  return result("success", "该管理员的帮助中心后台权限已经撤销。");
}
