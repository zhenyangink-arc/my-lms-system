"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStudentFeature } from "@/lib/student-permissions-server";
import type { DocumentActionState } from "./document-action-state";

const CHECKLIST_STATUSES = ["preparing", "completed", "not_needed"] as const;

function result(status: "success" | "error", message: string): DocumentActionState {
  return { status, message };
}

function revalidateDocumentPages(userId: string) {
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/admin/documents");
  revalidatePath(`/dashboard/admin/documents/${userId}`);
}

export type DocumentDraftChange = {
  documentId: string;
  status: "preparing" | "completed" | "not_needed";
};

export async function saveApplicationDocumentDraftAction(
  changes: DocumentDraftChange[]
): Promise<DocumentActionState> {
  const { supabase, user } = await requireStudentFeature("application_documents");

  if (changes.length === 0) {
    return result("success", "没有需要保存的修改。");
  }
  if (changes.some((change) => !CHECKLIST_STATUSES.includes(change.status))) {
    return result("error", "包含无效的资料状态。");
  }

  for (const change of changes) {
    const { error } = await supabase
      .from("student_application_documents")
      .update({ status: change.status })
      .eq("id", change.documentId)
      .eq("user_id", user.id);

    if (error) {
      return result("error", "保存失败，请刷新页面后重试。");
    }
  }

  revalidateDocumentPages(user.id);
  return result("success", "修改已保存。");
}

export async function submitApplicationDocumentsAction(
  targetId: string,
  _previousState: DocumentActionState,
  _formData: FormData
): Promise<DocumentActionState> {
  void _previousState;
  void _formData;
  const { supabase, user } = await requireStudentFeature("application_documents");

  const { count: unresolvedCount, error: countError } = await supabase
    .from("student_application_documents")
    .select("id", { count: "exact", head: true })
    .eq("target_id", targetId)
    .eq("user_id", user.id)
    .eq("status", "preparing")
    .is("admin_locked_at", null);

  if (countError) {
    return result("error", "提交失败，请刷新页面后重试。");
  }
  if ((unresolvedCount ?? 0) > 0) {
    return result("error", "还有材料未标记为「已完成」或「无」，请先处理完所有材料。");
  }

  const { data: updated, error } = await supabase
    .from("student_university_targets")
    .update({ documents_locked_at: new Date().toISOString() })
    .eq("id", targetId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return result("error", "提交失败，请刷新页面后重试。");
  }

  revalidateDocumentPages(user.id);
  redirect("/dashboard/documents");
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function saveCourierInfoAction(
  targetId: string,
  _previousState: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  void _previousState;
  const { supabase, user } = await requireStudentFeature("application_documents");

  const mailedAt = String(formData.get("courierMailedAt") ?? "").trim();
  const estimatedArrivalAt = String(formData.get("courierEstimatedArrivalAt") ?? "").trim();

  if (!mailedAt || !estimatedArrivalAt) {
    return result("error", "请同时填写快递邮寄时间和预计到达时间。");
  }
  if (!DATE_PATTERN.test(mailedAt)) {
    return result("error", "快递邮寄时间格式不正确。");
  }
  if (!DATE_PATTERN.test(estimatedArrivalAt)) {
    return result("error", "预计到达时间格式不正确。");
  }
  if (estimatedArrivalAt < mailedAt) {
    return result("error", "预计到达时间不能早于快递邮寄时间。");
  }

  const { data: existing } = await supabase
    .from("student_university_targets")
    .select("application_stage, courier_mailed_at, courier_estimated_arrival_at")
    .eq("id", targetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return result("error", "找不到这份申请表，请刷新页面后重试。");
  }
  if (existing.courier_mailed_at && existing.courier_estimated_arrival_at) {
    return result("error", "快递信息已确认锁定，如需修改请联系管理员。");
  }
  if (existing.application_stage < 2) {
    return result("error", "请等待管理员确认后再填写快递邮寄时间。");
  }

  const { data: updated, error } = await supabase
    .from("student_university_targets")
    .update({
      courier_mailed_at: mailedAt,
      courier_estimated_arrival_at: estimatedArrivalAt,
    })
    .eq("id", targetId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return result("error", "快递信息保存失败，请刷新页面后重试。");
  }

  revalidateDocumentPages(user.id);
  return result("success", "快递信息已保存。");
}
