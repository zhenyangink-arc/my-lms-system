"use server";

import { revalidatePath } from "next/cache";

import { requireAnnouncementAccess } from "@/lib/announcements";
import { requireActiveUser } from "@/lib/auth";
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
  revalidatePath("/dashboard/admin/announcements");
  revalidatePath("/dashboard");
}

export async function createAnnouncementAction(
  _previousState: AnnouncementActionState,
  formData: FormData
): Promise<AnnouncementActionState> {
  void _previousState;
  const { supabase, user, scope, tenantId } = await requireAnnouncementAccess();
  const input = readAnnouncementInput(formData);
  if ("error" in input && input.error) return result("error", input.error);

  const intent = String(formData.get("intent") ?? "draft");
  const status: AnnouncementStatus = intent === "publish" ? "published" : "draft";
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...input.data,
      scope,
      tenant_id: scope === "platform" ? null : tenantId,
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
  const { supabase, user, scope, tenantId } = await requireAnnouncementAccess();
  const input = readAnnouncementInput(formData);
  if ("error" in input && input.error) return result("error", input.error);

  let updateQuery = supabase
    .from("announcements")
    .update({ ...input.data, updated_by: user.id })
    .eq("id", announcementId)
    .eq("scope", scope);
  updateQuery = scope === "platform"
    ? updateQuery.is("tenant_id", null)
    : updateQuery.eq("tenant_id", tenantId);
  const { data, error } = await updateQuery
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

  const { supabase, user, scope, tenantId } = await requireAnnouncementAccess();
  let updateQuery = supabase
    .from("announcements")
    .update({ status: nextStatus, updated_by: user.id })
    .eq("id", announcementId)
    .eq("scope", scope);
  updateQuery = scope === "platform"
    ? updateQuery.is("tenant_id", null)
    : updateQuery.eq("tenant_id", tenantId);
  const { data, error } = await updateQuery
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "公告状态更新失败，请稍后重试。");
  refreshAnnouncements();
  return result(
    "success",
    nextStatus === "published" ? "公告已经发布。" : nextStatus === "archived" ? "公告已经归档。" : "公告已经转为草稿。"
  );
}

export async function markAnnouncementsReadAction(announcementIds: string[]) {
  const validIds = [...new Set(announcementIds.filter(isUuid))].slice(0, 100);
  if (validIds.length === 0) return;
  const { supabase } = await requireActiveUser();
  const { error } = await supabase.rpc("mark_visible_announcements_read", {
    requested_ids: validIds,
  });
  if (error) throw new Error("公告阅读状态保存失败，请稍后重试。");
}
