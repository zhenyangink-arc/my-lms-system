"use server";

import { revalidatePath } from "next/cache";

import { requireManagementAppAccess } from "@/lib/management-apps";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("role,status,membership_tier")
    .eq("tenant_id", access.tenantId)
    .eq("user_id", studentId)
    .maybeSingle();
  if (
    membershipError ||
    membership?.role !== "student" ||
    membership.status !== "active"
  ) {
    throw new Error("目标账号不是当前机构的有效学生。");
  }

  const { error } = await admin.from("student_app_enrollments").upsert(
    {
      tenant_id: access.tenantId,
      student_id: studentId,
      app_id: access.appId,
      status,
      access_tier: membership.membership_tier ?? "normal",
      enrolled_by: access.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,student_id,app_id" },
  );
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

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("role,status")
    .eq("tenant_id", access.tenantId)
    .eq("user_id", staffId)
    .maybeSingle();
  if (
    membershipError ||
    !membership ||
    membership.status !== "active" ||
    !new Set(["teacher", "admin", "ceo", "tenant_super_admin"]).has(
      membership.role,
    )
  ) {
    throw new Error("目标账号不是当前机构的有效员工。");
  }

  const permissions =
    accessRole === "administrator"
      ? {
          can_manage_students: true,
          can_manage_content: true,
          can_manage_assessments: true,
          can_view_analytics: true,
        }
      : accessRole === "operator"
        ? {
            can_manage_students: true,
            can_manage_content: false,
            can_manage_assessments: true,
            can_view_analytics: true,
          }
        : accessRole === "teacher"
          ? {
              can_manage_students: false,
              can_manage_content: false,
              can_manage_assessments: true,
              can_view_analytics: true,
            }
          : {
              can_manage_students: false,
              can_manage_content: false,
              can_manage_assessments: false,
              can_view_analytics: true,
            };

  const { error } = await admin.from("staff_app_assignments").upsert(
    {
      tenant_id: access.tenantId,
      staff_id: staffId,
      app_id: access.appId,
      access_role: accessRole,
      status,
      assigned_by: access.userId,
      updated_at: new Date().toISOString(),
      ...permissions,
    },
    { onConflict: "tenant_id,staff_id,app_id" },
  );
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
  const admin = createAdminClient();

  if (operation === "remove") {
    const { error } = await admin
      .from("tenant_student_assignments")
      .delete()
      .eq("tenant_id", access.tenantId)
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .eq("student_app_id", access.appId);
    if (error) throw new Error(`解除负责关系失败：${error.message}`);
  } else if (operation === "assign") {
    const { error } = await admin.from("tenant_student_assignments").upsert(
      {
        tenant_id: access.tenantId,
        student_id: studentId,
        teacher_id: teacherId,
        student_app_id: access.appId,
        assigned_by: access.userId,
      },
      {
        onConflict: "tenant_id,student_id,teacher_id,student_app_id",
        ignoreDuplicates: true,
      },
    );
    if (error) throw new Error(`分配负责老师失败：${error.message}`);
  } else {
    throw new Error("无效的师生分配操作。");
  }

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
  if (customTitle.length > 80) throw new Error("应用显示名称不能超过 80 个字。");

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_student_apps")
    .update({
      is_enabled: isEnabled,
      status,
      custom_title: customTitle || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", access.tenantId)
    .eq("app_id", access.appId);
  if (error) throw new Error(`应用设置保存失败：${error.message}`);
  revalidatePath(`${access.appPath}/settings`);
  revalidatePath(access.appPath);
  revalidatePath(`${access.dashboardBasePath}/admin/apps`);
}
