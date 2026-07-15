"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import type { VisaAdminActionState } from "./action-state";

const CASE_STATUSES = ["planning", "preparing", "ready_to_submit", "submitted", "additional_documents", "approved", "issued", "closed"];

function result(status: "success" | "error", message: string): VisaAdminActionState {
  return { status, message };
}

function revalidateVisa(studentId: string) {
  revalidatePath("/dashboard/admin/visa");
  revalidatePath(`/dashboard/admin/visa/${studentId}`);
  revalidatePath("/dashboard/visa");
}

export async function updateVisaCaseAdminAction(
  studentId: string,
  _previousState: VisaAdminActionState,
  formData: FormData
): Promise<VisaAdminActionState> {
  void _previousState;
  const { supabase, user } = await requireAdmin();
  const caseStatus = String(formData.get("case_status") ?? "").trim();
  const advisorNote = String(formData.get("advisor_note") ?? "").trim();
  if (!CASE_STATUSES.includes(caseStatus)) return result("error", "请选择有效的签证办理阶段。");
  if (advisorNote.length > 1000) return result("error", "顾问备注不能超过 1000 个字。");

  const { data, error } = await supabase
    .from("student_visa_cases")
    .update({
      case_status: caseStatus,
      advisor_note: advisorNote || null,
      assigned_admin_id: user.id,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "签证档案更新失败，请稍后重试。");
  revalidateVisa(studentId);
  return result("success", "整体办理阶段与顾问备注已经保存。");
}

export async function startVisaTaskReviewAction(
  taskId: string,
  _previousState: VisaAdminActionState,
  _formData: FormData
): Promise<VisaAdminActionState> {
  void _previousState;
  void _formData;
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("student_visa_tasks")
    .update({
      status: "reviewing",
      review_started_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: user.id,
    })
    .eq("id", taskId)
    .eq("status", "submitted")
    .select("id, user_id")
    .maybeSingle();

  if (error || !data) return result("error", "无法开始审核，任务状态可能已发生变化。");
  revalidateVisa(data.user_id);
  return result("success", "签证任务已经进入审核中。");
}

export async function completeVisaTaskReviewAction(
  taskId: string,
  _previousState: VisaAdminActionState,
  formData: FormData
): Promise<VisaAdminActionState> {
  void _previousState;
  const { supabase, user } = await requireAdmin();
  const decision = String(formData.get("decision") ?? "").trim();
  const adminNote = String(formData.get("admin_note") ?? "").trim();
  if (!["approved", "revision_required"].includes(decision)) return result("error", "请选择有效的审核结果。");
  if (decision === "revision_required" && adminNote.length < 2) return result("error", "退回补充时必须填写具体原因。");
  if (adminNote.length > 1000) return result("error", "审核意见不能超过 1000 个字。");

  const { data, error } = await supabase
    .from("student_visa_tasks")
    .update({
      status: decision,
      admin_note: adminNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", taskId)
    .eq("status", "reviewing")
    .select("id, user_id")
    .maybeSingle();

  if (error || !data) return result("error", "审核结果保存失败，任务状态可能已发生变化。");
  revalidateVisa(data.user_id);
  return result("success", decision === "approved" ? "任务已审核确认。" : "任务已退回学生补充。");
}
