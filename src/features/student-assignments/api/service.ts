import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAssignmentPageAccess } from "@/lib/student-assignments";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import type {
  AssignmentMember,
  PlatformTenantAssignmentRow,
  StudentAssignmentResult,
  StudentTeacherAssignment,
} from "./types";

type MembershipRow = {
  user_id: string;
  profiles:
    | { full_name: string | null; login_id: string | null; email: string | null }
    | { full_name: string | null; login_id: string | null; email: string | null }[]
    | null;
};

/** PostgREST 一对一关系返回对象、一对多返回数组，这里兼容两种结构。 */
function joinedProfile(row: MembershipRow) {
  return Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;
}

function mapAssignmentMember(row: MembershipRow): AssignmentMember {
  const profile = joinedProfile(row);
  return {
    id: String(row.user_id),
    full_name: profile?.full_name ?? null,
    login_id: profile?.login_id ?? null,
    email: profile?.email ?? null,
  };
}

export async function getStudentAssignmentData(): Promise<StudentAssignmentResult> {
  const access = await requireStudentAssignmentPageAccess();
  const admin = createAdminClient();

  if (access.scope === "platform") {
    const [tenantsResult, assignmentsResult, membershipsResult] = await Promise.all([
      admin.from("tenants").select("id, name, status").order("name", { ascending: true }),
      admin
        .from("tenant_student_assignments")
        .select("tenant_id, student_id, teacher_id")
        .eq("student_app_id", STUDENT_APP_IDS.korean),
      admin.from("tenant_memberships").select("tenant_id, user_id, role").eq("status", "active"),
    ]);

    const memberStats = new Map<string, { teacherIds: Set<string>; studentIds: Set<string> }>();
    for (const membership of membershipsResult.data ?? []) {
      const tenantKey = String(membership.tenant_id);
      const stats = memberStats.get(tenantKey) ?? { teacherIds: new Set<string>(), studentIds: new Set<string>() };
      if (membership.role === "teacher") stats.teacherIds.add(String(membership.user_id));
      else if (membership.role === "student") stats.studentIds.add(String(membership.user_id));
      memberStats.set(tenantKey, stats);
    }

    const assignedByTenant = new Map<string, Set<string>>();
    for (const assignment of assignmentsResult.data ?? []) {
      const tenantKey = String(assignment.tenant_id);
      const assignedStudents = assignedByTenant.get(tenantKey) ?? new Set<string>();
      assignedStudents.add(String(assignment.student_id));
      assignedByTenant.set(tenantKey, assignedStudents);
    }

    const rows: PlatformTenantAssignmentRow[] = (tenantsResult.data ?? []).map((tenant) => {
      const stats = memberStats.get(String(tenant.id)) ?? { teacherIds: new Set<string>(), studentIds: new Set<string>() };
      return {
        id: String(tenant.id),
        name: tenant.name,
        status: tenant.status,
        teacherCount: stats.teacherIds.size,
        studentCount: stats.studentIds.size,
        assignedCount: assignedByTenant.get(String(tenant.id))?.size ?? 0,
      };
    });

    return {
      scope: "platform",
      canManage: false,
      role: access.role,
      rows,
    };
  }

  const tenantId = access.tenantId!;
  const [studentsResult, teachersResult, assignmentsResult] = await Promise.all([
    admin
      .from("tenant_memberships")
      .select("user_id, profiles(full_name, login_id, email)")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
    admin
      .from("tenant_memberships")
      .select("user_id, profiles(full_name, login_id, email)")
      .eq("tenant_id", tenantId)
      .eq("role", "teacher")
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
    admin
      .from("tenant_student_assignments")
      .select("student_id, teacher_id")
      .eq("tenant_id", tenantId)
      .eq("student_app_id", STUDENT_APP_IDS.korean),
  ]);

  const students = ((studentsResult.data ?? []) as MembershipRow[]).map(mapAssignmentMember);
  const teachers = ((teachersResult.data ?? []) as MembershipRow[]).map(mapAssignmentMember);
  const assignments =
    (assignmentsResult.data as StudentTeacherAssignment[] | null) ?? [];
  const assignedStudentIds = [
    ...new Set(assignments.map((assignment) => String(assignment.student_id))),
  ];
  const assignedStudentIdSet = new Set(assignedStudentIds);

  return {
    scope: "tenant",
    canManage: true,
    role: access.role,
    tenantId,
    students,
    teachers,
    assignments,
    assignedStudentIds,
    unassignedStudents: students.filter((student) => !assignedStudentIdSet.has(student.id)),
  };
}
