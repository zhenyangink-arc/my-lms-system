import {
  setApplicationTeacherAssignmentAction,
  setStaffApplicationAccessAction,
  setStudentApplicationEnrollmentAction,
} from "@/app/dashboard/admin/apps/actions";
import { ManagementPlatformApplicationOverviewPage } from "@/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage";
import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import type { ManagementAppAccess } from "@/lib/management-apps";
import { createAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  user_id: string;
  role: string;
  membership_tier: string;
};
type ProfileRow = { id: string; full_name: string | null; email: string | null };
type EnrollmentRow = {
  student_id: string;
  status: "active" | "paused" | "completed" | "cancelled";
  access_tier: string;
};
type StaffAccessRow = {
  staff_id: string;
  access_role: "administrator" | "operator" | "teacher" | "viewer";
  status: "active" | "inactive";
};
type AssignmentRow = { student_id: string; teacher_id: string };

const roleLabels: Record<string, string> = {
  tenant_super_admin: "机构负责人",
  ceo: "运营负责人",
  admin: "管理员",
  teacher: "老师",
  administrator: "应用负责人",
  operator: "应用运营",
  viewer: "只读观察",
};

function displayName(profile: ProfileRow | undefined) {
  return profile?.full_name?.trim() || profile?.email || "未命名账号";
}

function HiddenAccessFields({ access }: { access: ManagementAppAccess }) {
  return (
    <>
      <input type="hidden" name="space" value={access.tenantSlug ?? "tenant"} />
      <input type="hidden" name="app_slug" value={access.app.slug} />
    </>
  );
}

export async function ManagementApplicationPeoplePage({
  access,
}: {
  access: ManagementAppAccess;
}) {
  if (!access.tenantId) {
    return <ManagementPlatformApplicationOverviewPage access={access} mode="students" />;
  }

  const admin = createAdminClient();
  const [membershipsResult, enrollmentsResult, staffAccessResult, assignmentsResult] =
    await Promise.all([
      admin
        .from("tenant_memberships")
        .select("user_id,role,membership_tier")
        .eq("tenant_id", access.tenantId)
        .eq("status", "active"),
      admin
        .from("student_app_enrollments")
        .select("student_id,status,access_tier")
        .eq("tenant_id", access.tenantId)
        .eq("app_id", access.appId),
      admin
        .from("staff_app_assignments")
        .select("staff_id,access_role,status")
        .eq("tenant_id", access.tenantId)
        .eq("app_id", access.appId),
      admin
        .from("tenant_student_assignments")
        .select("student_id,teacher_id")
        .eq("tenant_id", access.tenantId)
        .eq("student_app_id", access.appId),
    ]);
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profileData } = userIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", userIds)
    : { data: [] as ProfileRow[] };
  const profiles = new Map(
    ((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const students = memberships.filter((item) => item.role === "student");
  const staff = memberships.filter((item) => item.role !== "student");
  const enrollmentByStudent = new Map(
    ((enrollmentsResult.data ?? []) as EnrollmentRow[]).map((item) => [
      item.student_id,
      item,
    ]),
  );
  const staffAccessById = new Map(
    ((staffAccessResult.data ?? []) as StaffAccessRow[]).map((item) => [
      item.staff_id,
      item,
    ]),
  );
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const activeTeachers = staff.filter((member) => {
    const item = staffAccessById.get(member.user_id);
    return item?.status === "active" &&
      ["teacher", "operator", "administrator"].includes(item.access_role);
  });

  return (
    <div className="space-y-5">
      {(membershipsResult.error ||
        enrollmentsResult.error ||
        staffAccessResult.error ||
        assignmentsResult.error) && (
        <ManagementNotice tone="warning">
          应用授权数据暂时无法完整读取，请确认最新数据库迁移已经部署。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="应用成员概况"
        items={[
          { label: "机构学生", value: students.length },
          {
            label: "已开通",
            value: [...enrollmentByStudent.values()].filter(
              (item) => item.status === "active",
            ).length,
          },
          {
            label: "暂停／结束",
            value: [...enrollmentByStudent.values()].filter(
              (item) => item.status !== "active",
            ).length,
          },
          {
            label: "应用员工",
            value: [...staffAccessById.values()].filter(
              (item) => item.status === "active",
            ).length,
          },
          { label: "负责关系", value: assignments.length },
        ]}
      />

      {access.capabilities.manageTenantAvailability && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">员工应用权限</h2>
            <p className="app-muted-text mt-1 text-xs">先让老师或运营人员进入当前应用，再建立学生负责关系。</p>
          </div>
          <div className="overflow-x-auto border bg-[var(--app-card-bg)]">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">员工</th><th className="px-4 py-3">机构角色</th><th className="px-4 py-3">应用角色</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">保存</th></tr></thead>
              <tbody>
                {staff.map((member) => {
                  const current = staffAccessById.get(member.user_id);
                  return (
                    <tr key={member.user_id} className="border-t border-[var(--app-border-soft)]">
                      <td className="px-4 py-3 font-medium">{displayName(profiles.get(member.user_id))}</td>
                      <td className="app-muted-text px-4 py-3">{roleLabels[member.role] ?? member.role}</td>
                      <td colSpan={3} className="px-4 py-2">
                        <form action={setStaffApplicationAccessAction} className="flex items-center justify-end gap-2">
                          <HiddenAccessFields access={access} />
                          <input type="hidden" name="staff_id" value={member.user_id} />
                          <select name="access_role" defaultValue={current?.access_role ?? (member.role === "teacher" ? "teacher" : "viewer")} className="app-input h-8 border px-2">
                            <option value="administrator">应用负责人</option><option value="operator">应用运营</option><option value="teacher">老师</option><option value="viewer">只读观察</option>
                          </select>
                          <select name="status" defaultValue={current?.status ?? "inactive"} className="app-input h-8 border px-2">
                            <option value="active">已启用</option><option value="inactive">未启用</option>
                          </select>
                          <button className="h-8 border border-[var(--app-border)] px-3 font-semibold hover:bg-[var(--app-soft-bg)]">保存</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">学生授权与负责老师</h2>
          <p className="app-muted-text mt-1 text-xs">只有“已开通”的学生才能进入当前应用并被分配给该应用老师。</p>
        </div>
        <div className="overflow-x-auto border bg-[var(--app-card-bg)]">
          <table className="w-full min-w-[940px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">学生</th><th className="px-4 py-3">机构等级</th><th className="px-4 py-3">应用状态</th><th className="px-4 py-3">负责老师</th><th className="px-4 py-3">新增老师</th></tr></thead>
            <tbody>
              {students.map((student) => {
                const enrollment = enrollmentByStudent.get(student.user_id);
                const studentAssignments = assignments.filter((item) => item.student_id === student.user_id);
                return (
                  <tr key={student.user_id} className="border-t border-[var(--app-border-soft)] align-top">
                    <td className="px-4 py-3 font-medium">{displayName(profiles.get(student.user_id))}</td>
                    <td className="app-muted-text px-4 py-3">{student.membership_tier}</td>
                    <td className="px-4 py-2">
                      <form action={setStudentApplicationEnrollmentAction} className="flex items-center gap-2">
                        <HiddenAccessFields access={access} /><input type="hidden" name="student_id" value={student.user_id} />
                        <select name="status" defaultValue={enrollment?.status ?? "paused"} className="app-input h-8 border px-2"><option value="active">已开通</option><option value="paused">已暂停</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select>
                        <button className="h-8 border border-[var(--app-border)] px-3 font-semibold hover:bg-[var(--app-soft-bg)]">保存</button>
                      </form>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {studentAssignments.map((item) => (
                          <form key={item.teacher_id} action={setApplicationTeacherAssignmentAction}>
                            <HiddenAccessFields access={access} /><input type="hidden" name="student_id" value={student.user_id} /><input type="hidden" name="teacher_id" value={item.teacher_id} /><input type="hidden" name="operation" value="remove" />
                            <button className="rounded-full border px-2.5 py-1 hover:bg-[var(--app-soft-bg)]" title="点击解除负责关系">{displayName(profiles.get(item.teacher_id))} ×</button>
                          </form>
                        ))}
                        {studentAssignments.length === 0 && <span className="app-muted-text py-1">尚未分配</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <form action={setApplicationTeacherAssignmentAction} className="flex items-center gap-2">
                        <HiddenAccessFields access={access} /><input type="hidden" name="student_id" value={student.user_id} /><input type="hidden" name="operation" value="assign" />
                        <select name="teacher_id" className="app-input h-8 min-w-36 border px-2" required defaultValue=""><option value="" disabled>选择应用老师</option>{activeTeachers.map((teacher) => <option key={teacher.user_id} value={teacher.user_id}>{displayName(profiles.get(teacher.user_id))}</option>)}</select>
                        <button disabled={!enrollment || enrollment.status !== "active" || activeTeachers.length === 0} className="h-8 border border-[var(--app-border)] px-3 font-semibold hover:bg-[var(--app-soft-bg)] disabled:cursor-not-allowed disabled:opacity-40">分配</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && <tr><td colSpan={5} className="app-muted-text px-4 py-10 text-center">当前机构还没有有效学生账号。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
