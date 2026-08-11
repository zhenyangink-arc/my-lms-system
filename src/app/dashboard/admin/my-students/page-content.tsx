import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { LocalDateTime } from "@/components/LocalDateTime";
import { StudentCoursesDialog } from "./StudentCoursesDialog";
import { GroupClassDialog } from "./GroupClassDialog";

export const dynamic = "force-dynamic";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };

type MyStudentRow = {
  id: string;
  full_name: string | null;
  login_id: string | null;
  email: string | null;
  status: string | null;
  membership_tier: string | null;
  registered_at: string | null;
  created_at: string;
};

export default async function MyStudentsPage() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = profile?.role ?? "student";

  if (role !== "teacher" || !tenant) redirect("/dashboard");

  const admin = createAdminClient();
  const studentIds = await getTeacherAssignedStudentIds(supabase, tenant.id, user.id);

  const { data: profilesData } =
    studentIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, login_id, email, status, membership_tier, registered_at, created_at")
          .in("id", studentIds)
      : { data: [] as { id: string; full_name: string | null; login_id: string | null; email: string | null; status: string | null; membership_tier: string | null; registered_at: string | null; created_at: string }[] };

  const students: MyStudentRow[] = ((profilesData ?? []) as MyStudentRow[]).sort((a, b) =>
    (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "zh-CN")
  );

  const activeCount = students.filter((student) => student.status === "active").length;
  const vipCount = students.filter((student) => normalizeMembershipTier(student.membership_tier) !== "normal").length;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 sm:p-5">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="app-muted-text text-[11px] font-semibold tracking-[0.16em]">教学管理</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">我的学生</h2>
            </div>
            <GroupClassDialog students={students.map((s) => ({ id: s.id, full_name: s.full_name, login_id: s.login_id }))} />
          </div>
        </div>
        <div className="grid border-t sm:grid-cols-3" style={{ borderColor: "var(--app-border)" }}>
          {[
            ["负责学生", students.length],
            ["正常使用", activeCount],
            ["会员学生", vipCount],
          ].map(([label, value], index) => (
            <div key={String(label)} className={`px-5 py-3 ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`} style={{ borderColor: "var(--app-border)" }}>
              <p className="app-muted-text text-[11px] font-medium">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-card overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b text-[11px] font-medium" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}>
                <th className="w-[30%] px-4 py-2.5 font-medium">学生</th>
                <th className="w-[12%] px-4 py-2.5 font-medium">会员档位</th>
                <th className="w-[10%] px-4 py-2.5 font-medium">状态</th>
                <th className="w-[16%] px-4 py-2.5 font-medium">最近活跃</th>
                <th className="px-4 py-2.5 font-medium">注册时间</th>
                <th className="w-[12%] px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const displayName = student.full_name || "未填写姓名";
                const loginId = student.login_id || student.email?.split("@")[0] || `…${student.id.slice(-8)}`;
                const tier = normalizeMembershipTier(student.membership_tier);
                return (
                  <tr key={student.id} className="border-b text-xs last:border-b-0 hover:bg-black/[0.018]" style={{ borderColor: "var(--app-border)" }}>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{displayName}</p>
                          <p className="app-muted-text mt-0.5 truncate text-[11px]">{loginId}{student.email && student.email !== loginId ? ` · ${student.email}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-black/[0.035] px-2 py-1 text-[11px] font-medium">{MEMBERSHIP_TIER_LABELS[tier]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium" style={{ color: student.status === "active" ? "var(--app-success)" : student.status === "suspended" ? "var(--app-warm)" : "var(--app-muted-text)" }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: student.status === "active" ? "var(--app-success)" : student.status === "suspended" ? "var(--app-warm)" : "var(--app-border)" }} />
                        {student.status === "active" ? "正常" : student.status === "suspended" ? "暂停" : student.status === "inactive" ? "已停用" : student.status || "未知"}
                      </span>
                    </td>
                    <td className="app-muted-text px-4 py-3 tabular-nums"><LocalDateTime value={student.registered_at ?? null} options={DATE_TIME_OPTIONS} fallback="暂无记录" /></td>
                    <td className="app-muted-text px-4 py-3 tabular-nums"><LocalDateTime value={student.created_at ?? null} options={DATE_TIME_OPTIONS} fallback="暂无记录" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end whitespace-nowrap">
                        <StudentCoursesDialog studentId={student.id} studentName={displayName} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs">
                    还没有分配给你的学生，请联系机构负责人把学生划给你。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
