"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { getGradeCenterAccess, requireGradeCenterManager } from "@/lib/grade-center";
import { requireTenantAppCapability } from "@/lib/tenant-app-capabilities";
import type { GradeCenterActionState } from "./action-state";
import { GRADE_REVIEW_STATUSES, type GradeReviewStatus } from "./config";

export type LiveGradeSourceType =
  | "assignment_submission"
  | "chapter_test_attempt";

function result(status: "success" | "error", message: string): GradeCenterActionState { return { status, message }; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function refreshGrades(itemId?: string) { revalidateDashboard("/dashboard/grades"); revalidateDashboard("/dashboard/admin/grades"); revalidateDashboard("/dashboard/admin"); if (itemId) revalidateDashboard(`/dashboard/admin/grades/${itemId}`); }

export async function requestSourceGradeReviewAction(sourceType: LiveGradeSourceType, sourceResultId: string, _state: GradeCenterActionState, formData: FormData): Promise<GradeCenterActionState> {
  void _state;
  if (!(sourceType === "assignment_submission" || sourceType === "chapter_test_attempt") || !isUuid(sourceResultId)) return result("error", "成绩来源或记录编号不正确。");
  const access = await getGradeCenterAccess();
  if (access.role !== "student") return result("error", "当前账号不能申请学生成绩复核。");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 2 || reason.length > 2000) return result("error", "复核原因需要填写 2 至 2000 个字。");
  const { error } = await access.supabase.rpc("request_source_grade_review", {
    p_source_type: sourceType,
    p_source_result_id: sourceResultId,
    p_reason: reason,
  });
  if (error) return result("error", "复核申请提交失败，可能已有申请正在处理中。");
  refreshGrades();
  return result("success", "成绩复核申请已经提交。");
}
export async function resolveGradeReviewAction(reviewId: string, studentAppId: string | null, _state: GradeCenterActionState, formData: FormData): Promise<GradeCenterActionState> { void _state; if (!isUuid(reviewId)) return result("error", "复核申请编号不正确。"); const { supabase } = studentAppId ? await requireTenantAppCapability(studentAppId, "manageAssessments") : await requireGradeCenterManager(); const status = String(formData.get("status") ?? "reviewing"); const response = String(formData.get("response") ?? "").trim(); if (!(GRADE_REVIEW_STATUSES as readonly string[]).includes(status) || status === "pending") return result("error", "请选择有效的复核处理状态。"); if (response.length > 3000) return result("error", "复核回复不能超过 3000 个字。"); const { error } = await supabase.rpc("resolve_grade_review", { p_review_id: reviewId, p_status: status as GradeReviewStatus, p_response: response }); if (error) return result("error", "复核处理结果保存失败。"); refreshGrades(); return result("success", "复核处理结果已经同步给学生。"); }
