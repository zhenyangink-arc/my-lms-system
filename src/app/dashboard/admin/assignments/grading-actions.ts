"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { requireAssignmentManager } from "@/lib/learning-assignments";
import type { LearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";

function result(status: "success" | "error", message: string): LearningAssignmentActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function friendlyError(message: string | undefined, fallback: string) {
  return message && message.length <= 240 && /[\u3400-\u9fff]/u.test(message) ? message : fallback;
}

function validateContent(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  return content.length >= 1 && content.length <= 500 ? content : null;
}

function refreshGradingPages() {
  revalidateDashboard("/dashboard/admin/assignments");
}

export async function createLearningGradingCommentAction(
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  const content = validateContent(formData);
  if (!content) return result("error", "常用评语必须为 1 到 500 个字。");
  const { supabase } = await requireAssignmentManager();
  const { error } = await supabase.rpc("create_learning_grading_comment", { p_content: content });
  if (error) return result("error", friendlyError(error.message, "常用评语新增失败，请稍后重试。"));
  refreshGradingPages();
  return result("success", "常用评语已新增。");
}

export async function updateLearningGradingCommentAction(
  commentId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(commentId)) return result("error", "常用评语编号不正确。");
  const content = validateContent(formData);
  if (!content) return result("error", "常用评语必须为 1 到 500 个字。");
  const { supabase } = await requireAssignmentManager();
  const { error } = await supabase.rpc("update_learning_grading_comment", {
    p_comment_id: commentId,
    p_content: content,
  });
  if (error) return result("error", friendlyError(error.message, "常用评语修改失败，请稍后重试。"));
  refreshGradingPages();
  return result("success", "常用评语已修改。");
}

export async function deleteLearningGradingCommentAction(
  commentId: string,
  _previousState: LearningAssignmentActionState,
  _formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(commentId)) return result("error", "常用评语编号不正确。");
  const { supabase } = await requireAssignmentManager();
  const { error } = await supabase.rpc("delete_learning_grading_comment", {
    p_comment_id: commentId,
  });
  if (error) return result("error", friendlyError(error.message, "常用评语删除失败，请稍后重试。"));
  refreshGradingPages();
  return result("success", "常用评语已删除。");
}
