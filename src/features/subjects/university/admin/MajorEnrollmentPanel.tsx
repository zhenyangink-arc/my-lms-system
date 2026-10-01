import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { SubjectSectionExtrasProps } from "../../admin-slot-contract.ts";
import { setStudentMajorAction } from "./actions";

type CategoryRow = { id: string; title: string; sort_order: number };
type ProfileRow = { id: string; full_name: string | null; email: string | null };
type MembershipRow = { user_id: string; profile: ProfileRow | ProfileRow[] | null };

const MAX_STUDENTS = 500;

function oneProfile(profile: MembershipRow["profile"]): ProfileRow | null {
  return Array.isArray(profile) ? (profile[0] ?? null) : profile;
}

/** 学生分区底部：机构给大学课程的学生设置所属专业（可多个，如主修加辅修）。 */
export async function MajorEnrollmentPanel({ access }: SubjectSectionExtrasProps) {
  if (access.scope !== "tenant" || !access.tenantId || !access.capabilities.manageStudents) return null;

  const supabase = await createClient();
  const [categoriesResult, modesResult, enrollmentsResult, majorRowsResult] = await Promise.all([
    supabase
      .from("course_categories")
      .select("id,title,sort_order")
      .eq("student_app_id", access.appId)
      .not("parent_id", "is", null)
      .eq("is_published", true)
      .order("sort_order"),
    supabase.from("university_category_access").select("category_id,mode"),
    supabase
      .from("student_app_enrollments")
      .select("student_id")
      .eq("tenant_id", access.tenantId)
      .eq("app_id", access.appId)
      .eq("status", "active")
      .limit(MAX_STUDENTS),
    supabase
      .from("student_major_enrollments")
      .select("student_id,category_id")
      .eq("tenant_id", access.tenantId)
      .eq("status", "active"),
  ]);

  const failed = categoriesResult.error || modesResult.error || enrollmentsResult.error || majorRowsResult.error;
  if (failed) {
    return (
      <section className="border bg-[var(--card)] p-4 text-xs" role="alert">
        学生专业暂时无法读取，请稍后刷新页面。
      </section>
    );
  }

  const nonMajor = new Set((modesResult.data ?? []).filter((row) => row.mode !== "major").map((row) => row.category_id as string));
  const majors = ((categoriesResult.data ?? []) as CategoryRow[]).filter((category) => !nonMajor.has(category.id));
  const majorTitle = new Map(majors.map((major) => [major.id, major.title]));
  const studentIds = (enrollmentsResult.data ?? []).map((row) => row.student_id as string);

  const profiles = new Map<string, ProfileRow>();
  if (studentIds.length > 0) {
    const { data } = await createAdminClient()
      .from("tenant_memberships")
      .select("user_id,profile:profiles!tenant_memberships_user_id_fkey(id,full_name,email)")
      .eq("tenant_id", access.tenantId)
      .eq("role", "student")
      .in("user_id", studentIds);
    for (const row of (data ?? []) as MembershipRow[]) {
      const profile = oneProfile(row.profile);
      if (profile) profiles.set(row.user_id, profile);
    }
  }
  const majorIdsByStudent = new Map<string, string[]>();
  for (const row of majorRowsResult.data ?? []) {
    const list = majorIdsByStudent.get(row.student_id as string) ?? [];
    list.push(row.category_id as string);
    majorIdsByStudent.set(row.student_id as string, list);
  }

  const space = access.tenantSlug ?? "tenant";

  return (
    <section className="space-y-3" aria-labelledby="university-major-title">
      <CardTitleWithHint
        headingLevel={2}
        title={<span id="university-major-title">学生所属专业</span>}
        titleClassName="text-sm font-semibold"
        description="学生只能看到自己所属专业的课程，以及这些专业关联的公共课和通识课。没有选专业的学生只能看到通识课。一个学生可以有多个专业（如主修加辅修）。"
      />
      {majors.length === 0 ? (
        <div className="app-muted-text border bg-[var(--card)] p-4 text-xs">
          还没有可选的专业。请先由平台负责人在“课程结构”中建立大学课程的专业。
        </div>
      ) : studentIds.length === 0 ? (
        <div className="app-muted-text border bg-[var(--card)] p-4 text-xs">还没有已开通大学课程的学生。</div>
      ) : (
        <div className="overflow-x-auto border bg-[var(--card)]">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <caption className="sr-only">大学课程学生的所属专业</caption>
            <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
              <tr><th className="px-4 py-2">学生</th><th className="px-4 py-2">所属专业</th><th className="px-4 py-2">添加专业</th></tr>
            </thead>
            <tbody>
              {studentIds.map((studentId) => {
                const profile = profiles.get(studentId);
                const name = profile?.full_name?.trim() || profile?.email || "未命名账号";
                const owned = (majorIdsByStudent.get(studentId) ?? []).filter((id) => majorTitle.has(id));
                const addable = majors.filter((major) => !owned.includes(major.id));
                return (
                  <tr key={studentId} className="border-t border-[var(--border-subtle)] align-top">
                    <td className="px-4 py-2 font-medium">{name}</td>
                    <td className="px-4 py-2">
                      {owned.length === 0 ? (
                        <span className="app-muted-text">未选专业</span>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {owned.map((categoryId) => (
                            <li key={categoryId}>
                              <form action={setStudentMajorAction} className="inline-flex items-center gap-1">
                                <input type="hidden" name="space" value={space} />
                                <input type="hidden" name="student_id" value={studentId} />
                                <input type="hidden" name="category_id" value={categoryId} />
                                <input type="hidden" name="status" value="cancelled" />
                                <span className="border border-[var(--border)] px-2 py-1">{majorTitle.get(categoryId)}</span>
                                <button aria-label={`移除${name}的专业${majorTitle.get(categoryId)}`} className="h-6 px-1 font-semibold hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">移除</button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <form action={setStudentMajorAction} className="flex items-center gap-2">
                        <input type="hidden" name="space" value={space} />
                        <input type="hidden" name="student_id" value={studentId} />
                        <input type="hidden" name="status" value="active" />
                        <select aria-label={`给${name}添加专业`} name="category_id" disabled={addable.length === 0} className="app-input h-8 border px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                          {addable.map((major) => <option key={major.id} value={major.id}>{major.title}</option>)}
                        </select>
                        <button aria-label={`为${name}添加所选专业`} disabled={addable.length === 0} className="h-8 border border-[var(--border)] px-3 font-semibold hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40">添加</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
