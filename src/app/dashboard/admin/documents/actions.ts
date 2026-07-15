"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import type { ReviewActionState } from "./action-state";

function result(status: "success" | "error", message: string): ReviewActionState {
  return { status, message };
}

export async function startDocumentReviewAction(
  documentId: string,
  _previousState: ReviewActionState,
  _formData: FormData
): Promise<ReviewActionState> {
  void _previousState;
  void _formData;
  const { supabase, user } = await requireAdmin();

  const { data: updatedDocument, error } = await supabase
    .from("student_application_documents")
    .update({
      status: "reviewing",
      review_started_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: user.id,
      review_note: null,
    })
    .eq("id", documentId)
    .eq("status", "pending_review")
    .not("storage_path", "is", null)
    .select("id, user_id")
    .maybeSingle();

  if (error || !updatedDocument) {
    return result("error", "无法开始审核，材料可能已经被其他管理员处理。");
  }

  revalidatePath("/dashboard/admin/documents");
  revalidatePath(`/dashboard/admin/documents/${updatedDocument.user_id}`);
  revalidatePath("/dashboard/documents");
  return result("success", "材料已进入审核中。");
}

export async function completeDocumentReviewAction(
  documentId: string,
  _previousState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  void _previousState;
  const { supabase, user } = await requireAdmin();
  const decision = String(formData.get("decision") ?? "").trim();
  const reviewNote = String(formData.get("review_note") ?? "").trim();

  if (!["approved", "revision_required"].includes(decision)) {
    return result("error", "请选择有效的审核结果。");
  }
  if (decision === "revision_required" && reviewNote.length < 2) {
    return result("error", "退回材料时必须填写明确的修改意见。");
  }
  if (reviewNote.length > 500) return result("error", "审核意见不能超过 500 个字。");

  const { data: updatedDocument, error } = await supabase
    .from("student_application_documents")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_note: reviewNote || null,
    })
    .eq("id", documentId)
    .eq("status", "reviewing")
    .select("id, user_id")
    .maybeSingle();

  if (error || !updatedDocument) {
    return result("error", "审核结果保存失败，材料状态可能已经发生变化。");
  }

  revalidatePath("/dashboard/admin/documents");
  revalidatePath(`/dashboard/admin/documents/${updatedDocument.user_id}`);
  revalidatePath("/dashboard/documents");
  return result("success", decision === "approved" ? "材料审核完成，状态已确认为通过。" : "材料已退回，学生可以上传新版本。 ");
}
