"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import type { ModuleCardDeleteState } from "../StudentModuleCardDeleteDialog";
import type { VisaAdminActionState } from "./action-state";
import { getVisaCaseStages } from "../../visa/visa-case-stages";

const VISA_TYPES = ["d4_language", "d2_bachelor", "d2_master", "d2_doctor"];
const APPLICATION_CHANNELS = ["china_consulate", "korea_immigration"];

function result(status: "success" | "error", message: string): VisaAdminActionState {
  return { status, message };
}

function revalidateVisa(studentId: string) {
  revalidatePath("/dashboard/admin/visa");
  revalidatePath(`/dashboard/admin/visa/${studentId}`);
  revalidatePath("/dashboard/visa");
}

export async function deleteStudentVisaCardAction(
  studentId: string,
  _previousState: ModuleCardDeleteState,
  _formData: FormData
): Promise<ModuleCardDeleteState> {
  void _previousState;
  void _formData;
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("delete_student_visa_card", {
    requested_user_id: studentId,
  });

  if (error) {
    return { status: "error", message: "签证卡删除失败，请刷新后重试。" };
  }

  revalidateVisa(studentId);
  redirect("/dashboard/admin/visa?deleted=1");
}

export async function updateVisaCaseAdminAction(
  studentId: string,
  _previousState: VisaAdminActionState,
  formData: FormData
): Promise<VisaAdminActionState> {
  void _previousState;
  const { supabase, user } = await requireAdmin();
  const visaType = String(formData.get("visa_type") ?? "").trim();
  const applicationChannel = String(formData.get("application_channel") ?? "").trim();
  const targetEntryDate = String(formData.get("target_entry_date") ?? "").trim();
  const caseStatus = String(formData.get("case_status") ?? "").trim();
  const advisorNote = String(formData.get("advisor_note") ?? "").trim();
  if (!VISA_TYPES.includes(visaType)) return result("error", "请选择有效的签证类型。");
  if (!APPLICATION_CHANNELS.includes(applicationChannel)) return result("error", "请选择有效的签证办理通道。");
  if (targetEntryDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetEntryDate)) return result("error", "最晚入境日期格式不正确。");
  if (!getVisaCaseStages(applicationChannel).some((stage) => stage.status === caseStatus)) return result("error", "请选择当前办理通道的有效阶段。");
  if (advisorNote.length > 1000) return result("error", "顾问备注不能超过 1000 个字。");

  const { data: existingCase, error: existingCaseError } = await supabase
    .from("student_visa_cases")
    .select("id, source_target_id")
    .eq("user_id", studentId)
    .maybeSingle();

  if (existingCaseError || !existingCase) {
    return result("error", "找不到这名学生的签证档案。");
  }

  if (existingCase.source_target_id) {
    const { error: targetError } = await supabase
      .from("student_university_targets")
      .update({ visa_application_channel: applicationChannel })
      .eq("id", existingCase.source_target_id)
      .eq("user_id", studentId);

    if (targetError) return result("error", "签证办理通道同步失败，请稍后重试。");
  }

  const { data, error } = await supabase
    .from("student_visa_cases")
    .update({
      visa_type: visaType,
      application_channel: applicationChannel,
      target_entry_date: targetEntryDate || null,
      ...(applicationChannel === "korea_immigration" ? { application_city: null } : {}),
      case_status: caseStatus,
      advisor_note: advisorNote || null,
      assigned_admin_id: user.id,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", existingCase.id)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "签证档案更新失败，请稍后重试。");
  revalidateVisa(studentId);
  return result("success", "签证类型、办理通道、最晚入境日期与跟进信息已保存。");
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
