"use server";

import { revalidatePath } from "next/cache";

import { requireStudentFeature } from "@/lib/student-permissions-server";
import type { VisaActionState } from "./visa-action-state";

const APPLICATION_CHANNELS = ["china_consulate", "korea_immigration"];
const STUDENT_STATUSES = ["pending", "in_progress", "submitted", "blocked"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACCOMMODATION_STATUSES = ["on_campus_dormitory", "off_campus_dormitory", "rental"];

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
  const { data: visaCase, error: visaCaseError } = await supabase
    .from("student_visa_cases")
    .select("id, source_target_id, target_entry_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (visaCaseError || !visaCase?.source_target_id) {
    return result("error", "签证办理通道尚未由管理员确认，请联系管理员处理。");
  }

  const { data: eligibleTarget, error: eligibilityError } = await supabase
    .from("student_university_targets")
    .select("id, visa_application_channel")
    .eq("id", visaCase.source_target_id)
    .eq("user_id", user.id)
    .gte("application_stage", 9)
    .maybeSingle();

  if (eligibilityError || !eligibleTarget) {
    return result("error", "申请进度到达第九步后才能填写签证信息。");
  }
  const applicationChannel = String(formData.get("application_channel") ?? "").trim();
  const applicationCity = String(formData.get("application_city") ?? "").trim();
  const residenceProvince = String(formData.get("residence_province") ?? "").trim();
  const residenceCity = String(formData.get("residence_city") ?? "").trim();
  const plannedEntryDate = String(formData.get("planned_entry_date") ?? "").trim();
  const departureProvince = String(formData.get("departure_province") ?? "").trim();
  const departureAirport = String(formData.get("departure_airport") ?? "").trim();
  const arrivalRegion = String(formData.get("arrival_region") ?? "").trim();
  const arrivalAirport = String(formData.get("arrival_airport") ?? "").trim();
  const accommodationStatus = String(formData.get("accommodation_status") ?? "").trim();
  const airportPickupService = String(formData.get("airport_pickup_service") ?? "").trim();

  if (!APPLICATION_CHANNELS.includes(eligibleTarget.visa_application_channel ?? "")) {
    return result("error", "签证办理通道尚未由管理员确认，请联系管理员处理。");
  }
  if (applicationChannel !== eligibleTarget.visa_application_channel) {
    return result("error", "签证办理通道由管理员确认，学生端不能修改。");
  }
  if (applicationCity.length > 80) return result("error", "递签城市不能超过 80 个字。");
  if (residenceProvince.length > 40) return result("error", "省份名称不能超过 40 个字。");
  if (residenceCity.length > 40) return result("error", "城市名称不能超过 40 个字。");
  if (plannedEntryDate && !DATE_PATTERN.test(plannedEntryDate)) return result("error", "预计入境时间格式不正确。");
  if (plannedEntryDate && visaCase.target_entry_date && plannedEntryDate > visaCase.target_entry_date) {
    return result("error", "预计入境时间不能晚于最晚入境日期。");
  }
  if (accommodationStatus && !ACCOMMODATION_STATUSES.includes(accommodationStatus)) return result("error", "请选择有效的住宿安排状态。");
  if (airportPickupService && !["required", "not_required"].includes(airportPickupService)) return result("error", "请选择是否需要接机服务。");
  if (departureProvince.length > 40) return result("error", "出境机场省份不能超过 40 个字。");
  if (departureAirport.length > 60) return result("error", "出境机场名称不能超过 60 个字。");
  if (arrivalRegion.length > 40) return result("error", "到达机场地区不能超过 40 个字。");
  if (arrivalAirport.length > 60) return result("error", "到达机场名称不能超过 60 个字。");

  const { data, error } = await supabase
    .from("student_visa_cases")
    .update({
      application_city: applicationCity || null,
      residence_province: applicationChannel === "china_consulate" ? (residenceProvince || null) : null,
      residence_city: applicationChannel === "china_consulate" ? (residenceCity || null) : null,
      planned_entry_date: plannedEntryDate || null,
      accommodation_status: accommodationStatus || null,
      airport_pickup_required: airportPickupService === "" ? null : airportPickupService === "required",
      departure_province: departureProvince || null,
      departure_airport: departureAirport || null,
      arrival_region: arrivalRegion || null,
      arrival_airport: arrivalAirport || null,
    })
    .eq("id", visaCase.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return result("error", "签证基础信息保存失败，请刷新后重试。");
  revalidateVisaPages(user.id);
  return result("success", "递签领区信息已保存。");
}

export async function updateVisaTaskAction(
  taskId: string,
  _previousState: VisaActionState,
  formData: FormData
): Promise<VisaActionState> {
  void _previousState;
  const { supabase, user } = await requireStudentFeature("visa_tasks");
  const { data: eligibleTarget, error: eligibilityError } = await supabase
    .from("student_university_targets")
    .select("id")
    .eq("user_id", user.id)
    .gte("application_stage", 9)
    .limit(1)
    .maybeSingle();

  if (eligibilityError || !eligibleTarget) {
    return result("error", "申请进度到达第九步后才能更新签证任务。");
  }
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
