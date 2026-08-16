"use server";

import { revalidatePath } from "next/cache";

import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";

function requiredValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`缺少 ${key}，请刷新后重试。`);
  return value;
}

async function requireTenantAppManager(formData: FormData) {
  const space = requiredValue(formData, "space");
  const appSlug = requiredValue(formData, "app_slug");
  const access = await requireManagementAppAccess(space, appSlug);
  if (!access.tenantId || access.scope !== "tenant") {
    throw new Error("请进入具体机构的应用工作区后再修改授权。");
  }
  if (!access.capabilities.manageStudents) {
    throw new Error("当前账号没有管理该应用学生的权限。");
  }
  return access;
}

export async function setStudentApplicationEnrollmentAction(
  formData: FormData,
) {
  const access = await requireTenantAppManager(formData);
  const studentId = requiredValue(formData, "student_id");
  const status = requiredValue(formData, "status");
  if (!new Set(["active", "paused", "completed", "cancelled"]).has(status)) {
    throw new Error("无效的学生应用状态。");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_student_application_enrollment", {
    p_student_id: studentId,
    p_app_id: access.appId,
    p_status: status,
  });
  if (error) throw new Error(`学生应用授权保存失败：${error.message}`);
  revalidatePath(`${access.appPath}/students`);
  revalidatePath(access.appPath);
}

export async function setStaffApplicationAccessAction(formData: FormData) {
  const access = await requireTenantAppManager(formData);
  if (!access.capabilities.manageTenantAvailability) {
    throw new Error("只有机构负责人可以调整员工的应用权限。");
  }
  const staffId = requiredValue(formData, "staff_id");
  const status = requiredValue(formData, "status");
  const accessRole = requiredValue(formData, "access_role");
  if (!new Set(["active", "inactive"]).has(status)) {
    throw new Error("无效的员工应用状态。");
  }
  if (!new Set(["administrator", "operator", "teacher", "viewer"]).has(accessRole)) {
    throw new Error("无效的员工应用角色。");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_application_access", {
    p_staff_id: staffId,
    p_app_id: access.appId,
    p_status: status,
    p_access_role: accessRole,
  });
  if (error) throw new Error(`员工应用权限保存失败：${error.message}`);
  revalidatePath(`${access.appPath}/students`);
  revalidatePath(access.appPath);
}

export async function setApplicationTeacherAssignmentAction(
  formData: FormData,
) {
  const access = await requireTenantAppManager(formData);
  const studentId = requiredValue(formData, "student_id");
  const teacherId = requiredValue(formData, "teacher_id");
  const operation = requiredValue(formData, "operation");
  if (!new Set(["remove", "assign"]).has(operation)) {
    throw new Error("无效的师生分配操作。");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_application_teacher_assignment", {
    p_student_id: studentId,
    p_teacher_id: teacherId,
    p_app_id: access.appId,
    p_operation: operation,
  });
  if (error) throw new Error(`师生负责关系保存失败：${error.message}`);

  revalidatePath(`${access.appPath}/students`);
}

export async function setTenantApplicationSettingsAction(formData: FormData) {
  const access = await requireTenantAppManager(formData);
  if (!access.capabilities.manageTenantAvailability) {
    throw new Error("只有机构负责人可以修改应用开放设置。");
  }
  const status = requiredValue(formData, "status");
  const customTitle = String(formData.get("custom_title") ?? "").trim();
  const isEnabled = formData.get("is_enabled") === "on";
  if (!new Set(["active", "coming_soon", "hidden"]).has(status)) {
    throw new Error("无效的机构应用状态。");
  }
  if (status === "active" && access.app.status !== "active") {
    throw new Error("平台标准应用仍在建设中，暂时不能切换为运行中。");
  }
  if (customTitle.length > 80) throw new Error("应用显示名称不能超过 80 个字。");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_application_settings", {
    p_app_id: access.appId,
    p_is_enabled: isEnabled,
    p_status: status,
    p_custom_title: customTitle,
  });
  if (error) throw new Error(`应用设置保存失败：${error.message}`);
  revalidatePath(`${access.appPath}/settings`);
  revalidatePath(access.appPath);
  revalidatePath(`${access.dashboardBasePath}/admin/apps`);
}
