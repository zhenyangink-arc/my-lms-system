"use server";

import { revalidatePath } from "next/cache";

import { requireStudentFeature } from "@/lib/student-permissions-server";
import type { VisaActionState } from "./visa-action-state";

const VISA_TYPES = ["d4_language", "d2_bachelor", "d2_master", "d2_doctor"];
const STUDENT_STATUSES = ["pending", "in_progress", "submitted", "blocked"];

function result(status: "success" | "error", message: string): VisaActionState {
  return { status, message };
}

function revalidateVisaPages(userId: string) {
  revalidatePath("/dashboard/visa");
  revalidatePath("/dashboard/admin/visa");
  revalidatePath(`/dashboard/admin/visa/${userId}`);
}

export async function initializeVisaWorkspaceAction(
  _previousState: VisaActionState,
  _formData: FormData
): Promise<VisaActionState> {
  void _previousState;
  void _formData;
  const { supabase, user } = await requireStudentFeature("visa_tasks");
  const { error } = await supabase.rpc("initialize_student_visa_workspace");
  if (error) return result("error", "签证路线创建失败，请稍后重试。");
  revalidateVisaPages(user.id);
  return result("success", "签证档案与标准任务已经建立。");
}

export async function updateVisaCaseAction(
  _previousState: VisaActionState,
  formData: FormData
): Promise<VisaActionState> {
  void _previousState;
  const { supabase, user } = await requireStudentFeature("visa_tasks");
  const visaType = String(formData.get("visa_type") ?? "").trim();
  const targetEntryDate = String(formData.get("target_entry_date") ?? "").trim();
  const applicationCity = String(formData.get("application_city") ?? "").trim();

  if (!VISA_TYPES.includes(visaType)) return result("error", "请选择有效的签证类型。");
  if (targetEntryDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetEntryDate)) {
    return result("error", "计划入境日期格式不正确。");
  }
  if (applicationCity.length > 80) return result("error", "递签城市不能超过 80 个字。");

  const { data, error } = await supabase
    .from("student_visa_cases")
    .update({
      visa_type: visaType,
      target_entry_date: targetEntryDate || null,
      application_city: applicationCity || null,
    })
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "签证基础信息保存失败，请刷新后重试。");
  revalidateVisaPages(user.id);
  return result("success", "签证基础信息已保存。");
}

export async function updateVisaTaskAction(
  taskId: string,
  _previousState: VisaActionState,
  formData: FormData
): Promise<VisaActionState> {
  void _previousState;
  const { supabase, user } = await requireStudentFeature("visa_tasks");
  const status = String(formData.get("status") ?? "").trim();
  const studentNote = String(formData.get("student_note") ?? "").trim();

  if (!STUDENT_STATUSES.includes(status)) return result("error", "请选择有效的准备状态。");
  if (studentNote.length > 400) return result("error", "个人备注不能超过 400 个字。");

  const { data, error } = await supabase
    .from("student_visa_tasks")
    .update({ status, student_note: studentNote || null })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return result("error", "任务更新失败，请按“准备中 → 提交审核”的顺序操作。");
  }

  revalidateVisaPages(user.id);
  return result("success", status === "submitted" ? "任务已提交，等待管理员审核。" : "签证任务状态已更新。");
}
