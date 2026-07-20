"use server";

import { revalidatePath } from "next/cache";

import { getAnnouncementAccess, requireAnnouncementAccess } from "@/lib/announcements";
import type { AnnouncementActionState } from "./action-state";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementStatus,
} from "./config";

function result(status: "success" | "error", message: string): AnnouncementActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readAnnouncementInput(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "general").trim();
  const priority = String(formData.get("priority") ?? "normal").trim();
  const isPinned = formData.get("is_pinned") === "on";

  if (title.length < 2 || title.length > 120) {
    return { error: "公告标题需要填写 2 至 120 个字。" } as const;
  }
  if (content.length < 2 || content.length > 5000) {
    return { error: "公告内容需要填写 2 至 5000 个字。" } as const;
  }
  if (!ANNOUNCEMENT_CATEGORIES.includes(category as AnnouncementCategory)) {
    return { error: "请选择有效的公告分类。" } as const;
  }
  if (!ANNOUNCEMENT_PRIORITIES.includes(priority as AnnouncementPriority)) {
    return { error: "请选择有效的公告级别。" } as const;
  }

  return {
    data: {
      title,
      content,
      category: category as AnnouncementCategory,
      priority: priority as AnnouncementPriority,
      is_pinned: isPinned,
    },
  } as const;
}

function refreshAnnouncements() {
  revalidatePath("/dashboard/announcements");
  revalidatePath("/dashboard");
}

export async function createAnnouncementAction(
  _previousState: AnnouncementActionState,
  formData: FormData
): Promise<AnnouncementActionState> {
  void _previousState;
  const { supabase, user } = await requireAnnouncementAccess();
  const input = readAnnouncementInput(formData);
  if ("error" in input && input.error) return result("error", input.error);

  const intent = String(formData.get("intent") ?? "draft");
  const status: AnnouncementStatus = intent === "publish" ? "published" : "draft";
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...input.data,
      status,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "公告保存失败，请稍后重试。");
  refreshAnnouncements();
  return result("success", status === "published" ? "公告已经发布。" : "公告草稿已经保存。");
}

export async function updateAnnouncementAction(
  announcementId: string,
  _previousState: AnnouncementActionState,
  formData: FormData
): Promise<AnnouncementActionState> {
  void _previousState;
  if (!isUuid(announcementId)) return result("error", "公告编号不正确，请刷新页面重试。");
  const { supabase, user } = await requireAnnouncementAccess();
  const input = readAnnouncementInput(formData);
  if ("error" in input && input.error) return result("error", input.error);

  const { data, error } = await supabase
    .from("announcements")
    .update({ ...input.data, updated_by: user.id })
    .eq("id", announcementId)
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "公告修改失败，请确认记录仍然存在。");
  refreshAnnouncements();
  return result("success", "公告内容已经更新。");
}

export async function changeAnnouncementStatusAction(
  announcementId: string,
  nextStatus: AnnouncementStatus,
  _previousState: AnnouncementActionState,
  _formData: FormData
): Promise<AnnouncementActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(announcementId)) return result("error", "公告编号不正确，请刷新页面重试。");
  if (!ANNOUNCEMENT_STATUSES.includes(nextStatus)) return result("error", "公告状态不正确。");

  const { supabase, user } = await requireAnnouncementAccess();
  const { data, error } = await supabase
    .from("announcements")
    .update({ status: nextStatus, updated_by: user.id })
    .eq("id", announcementId)
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "公告状态更新失败，请稍后重试。");
  refreshAnnouncements();
  return result(
    "success",
    nextStatus === "published" ? "公告已经发布。" : nextStatus === "archived" ? "公告已经归档。" : "公告已经转为草稿。"
  );
}

export async function grantAnnouncementAdminAction(
  _previousState: AnnouncementActionState,
  formData: FormData
): Promise<AnnouncementActionState> {
  void _previousState;
  const access = await getAnnouncementAccess();
  if (!access.canAssignAdmins) return result("error", "只有负责人可以指定公告管理员。");

  const adminId = String(formData.get("admin_id") ?? "").trim();
  if (!isUuid(adminId)) return result("error", "请选择需要授权的管理员。");

  const { data: target, error: targetError } = await access.supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", adminId)
    .maybeSingle();
  if (targetError || !target || target.role !== "admin" || (target.status && target.status !== "active")) {
    return result("error", "只能授权状态正常的管理员账号。");
  }

  const { error } = await access.supabase
    .from("announcement_admin_assignments")
    .upsert(
      {
        admin_id: adminId,
        granted_by: access.user.id,
        granted_at: new Date().toISOString(),
        revoked_by: null,
        revoked_at: null,
      },
      { onConflict: "tenant_id,admin_id" }
    );

  if (error) return result("error", "管理员授权失败，请稍后重试。");
  refreshAnnouncements();
  return result("success", "该管理员已经获得公告查看与发布权限。");
}

export async function revokeAnnouncementAdminAction(
  adminId: string,
  _previousState: AnnouncementActionState,
  _formData: FormData
): Promise<AnnouncementActionState> {
  void _previousState;
  void _formData;
  const access = await getAnnouncementAccess();
  if (!access.canAssignAdmins) return result("error", "只有负责人可以撤销公告管理员权限。");
  if (!isUuid(adminId)) return result("error", "管理员编号不正确，请刷新页面重试。");

  const { data, error } = await access.supabase
    .from("announcement_admin_assignments")
    .update({
      revoked_by: access.user.id,
      revoked_at: new Date().toISOString(),
    })
    .eq("admin_id", adminId)
    .is("revoked_at", null)
    .select("admin_id")
    .maybeSingle();

  if (error || !data) return result("error", "管理员权限撤销失败，请刷新页面重试。");
  refreshAnnouncements();
  return result("success", "该管理员的公告权限已经撤销。");
}
