"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAssignmentManager } from "@/lib/student-assignments";
import type { StudentAssignmentActionState } from "./state";

function actionError(message: string): StudentAssignmentActionState {
  return { status: "error", message };
}

function actionSuccess(message: string): StudentAssignmentActionState {
  return { status: "success", message };
}

/**
 * 把选中的学生划给选中的老师（一对多，可重复操作幂等）。
 * 数据库触发器会再次校验学生/老师都属于本机构且角色正确。
 */
export async function assignStudentsToTeachersAction(
  _previousState: StudentAssignmentActionState,
  formData: FormData
): Promise<StudentAssignmentActionState> {
  void _previousState;

  const studentIds = formData.getAll("student_ids").map(String).filter(Boolean);
  const teacherIds = formData.getAll("teacher_ids").map(String).filter(Boolean);

  if (studentIds.length === 0) return actionError("请至少选择一名学生。");
  if (teacherIds.length === 0) return actionError("请至少选择一位负责老师。");

  const access = await requireStudentAssignmentManager();
  const tenantId = access.tenantId;
  if (!tenantId) return actionError("当前不在机构工作台内，无法分配学生。");

  const admin = createAdminClient();

  // 只允许分配本机构内、角色匹配的账号（与数据库触发器同规则，先查再写更友好）。
  const { data: memberships, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .in("user_id", [...studentIds, ...teacherIds]);
  if (membershipError) return actionError("无法确认学生与老师名单，请稍后重试。");

  const validStudentIds = new Set(
    (memberships ?? [])
      .filter((membership) => membership.role === "student")
      .map((membership) => String(membership.user_id))
  );
  const validTeacherIds = new Set(
    (memberships ?? [])
      .filter((membership) => membership.role === "teacher")
      .map((membership) => String(membership.user_id))
  );

  const invalidStudents = studentIds.filter((id) => !validStudentIds.has(id));
  const invalidTeachers = teacherIds.filter((id) => !validTeacherIds.has(id));
  if (invalidStudents.length > 0 || invalidTeachers.length > 0) {
    return actionError("名单中包含不在本机构或角色不匹配的账号，请重新选择。");
  }

  const rows = studentIds.flatMap((studentId) =>
    teacherIds.map((teacherId) => ({
      tenant_id: tenantId,
      student_id: studentId,
      teacher_id: teacherId,
      assigned_by: access.user.id,
    }))
  );

  const { error: insertError } = await admin
    .from("tenant_student_assignments")
    .upsert(rows, { onConflict: "tenant_id,student_id,teacher_id", ignoreDuplicates: true });

  if (insertError) return actionError("分配失败，请稍后重试。");

  revalidateDashboard("/dashboard/admin/student-assignments");
  return actionSuccess(
    `已将 ${studentIds.length} 名学生划给 ${teacherIds.length} 位老师。`
  );
}

/** 解除某位老师与某名学生的负责关系。 */
export async function removeStudentTeacherAssignmentAction(
  formData: FormData
): Promise<void> {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const teacherId = String(formData.get("teacher_id") ?? "").trim();
  if (!studentId || !teacherId) throw new Error("缺少学生或老师编号，请刷新页面后重试。");

  const access = await requireStudentAssignmentManager();
  const tenantId = access.tenantId;
  if (!tenantId) throw new Error("当前不在机构工作台内，无法解除分配。");

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_student_assignments")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId);

  if (error) throw new Error("解除分配失败，请稍后重试。");

  revalidateDashboard("/dashboard/admin/student-assignments");
}
