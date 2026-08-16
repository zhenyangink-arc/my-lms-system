import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import type { ManagementAppAccess } from "@/lib/management-apps";
import { createAdminClient } from "@/lib/supabase/admin";

type OverviewMode = "students" | "grades" | "records" | "conversation";
type TenantRow = { id: string; name: string };
type TenantFact = { tenant_id: string; status?: string };
type AssignmentRow = { id: string; tenant_id: string; status: string };
type SubmissionRow = { tenant_id: string; status: string };
type TimeRow = { tenant_id: string; seconds: number | null };
type ScenarioRow = { id: string; tenant_id: string; status: string };
type ConversationProgressRow = { tenant_id: string; status: string };

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export async function ManagementPlatformApplicationOverviewPage({
  access,
  mode,
}: {
  access: ManagementAppAccess;
  mode: OverviewMode;
}) {
  const admin = createAdminClient();
  const [tenantResult, enrollmentResult, staffResult, assignmentResult, noteResult, timeResult, scenarioResult] =
    await Promise.all([
      admin.from("tenants").select("id,name").eq("status", "active").order("name"),
      admin
        .from("student_app_enrollments")
        .select("tenant_id,status")
        .eq("app_id", access.appId)
        .limit(5000),
      admin
        .from("staff_app_assignments")
        .select("tenant_id,status")
        .eq("app_id", access.appId)
        .limit(5000),
      admin
        .from("learning_assignments")
        .select("id,tenant_id,status")
        .eq("student_app_id", access.appId)
        .limit(5000),
      admin
        .from("learning_record_notes")
        .select("tenant_id,status")
        .eq("student_app_id", access.appId)
        .limit(5000),
      admin
        .from("learning_time_log")
        .select("tenant_id,seconds")
        .eq("student_app_id", access.appId)
        .limit(5000),
      admin
        .from("conversation_practice_scenarios")
        .select("id,tenant_id,status")
        .eq("student_app_id", access.appId)
        .limit(5000),
    ]);

  const assignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const assignmentIds = assignments.map((item) => item.id);
  const scenarios = (scenarioResult.data ?? []) as ScenarioRow[];
  const scenarioIds = scenarios.map((item) => item.id);
  const [submissionResult, conversationProgressResult] = await Promise.all([
    assignmentIds.length
      ? admin
          .from("learning_submissions")
          .select("tenant_id,status")
          .in("assignment_id", assignmentIds)
          .limit(5000)
      : Promise.resolve({ data: [] as SubmissionRow[], error: null }),
    scenarioIds.length
      ? admin
          .from("conversation_practice_progress")
          .select("tenant_id,status")
          .in("scenario_id", scenarioIds)
          .limit(5000)
      : Promise.resolve({ data: [] as ConversationProgressRow[], error: null }),
  ]);

  const tenants = (tenantResult.data ?? []) as TenantRow[];
  const activeStudents = new Map<string, number>();
  const activeStaff = new Map<string, number>();
  const assignmentCounts = new Map<string, number>();
  const publishedAssignments = new Map<string, number>();
  const submissions = new Map<string, number>();
  const gradedSubmissions = new Map<string, number>();
  const notes = new Map<string, number>();
  const activeNotes = new Map<string, number>();
  const learningSeconds = new Map<string, number>();
  const scenarioCounts = new Map<string, number>();
  const publishedScenarios = new Map<string, number>();
  const conversationPractices = new Map<string, number>();
  const completedConversationPractices = new Map<string, number>();

  for (const row of (enrollmentResult.data ?? []) as TenantFact[]) {
    if (row.status === "active") increment(activeStudents, row.tenant_id);
  }
  for (const row of (staffResult.data ?? []) as TenantFact[]) {
    if (row.status === "active") increment(activeStaff, row.tenant_id);
  }
  for (const row of assignments) {
    increment(assignmentCounts, row.tenant_id);
    if (row.status === "published") increment(publishedAssignments, row.tenant_id);
  }
  for (const row of (submissionResult.data ?? []) as SubmissionRow[]) {
    increment(submissions, row.tenant_id);
    if (row.status === "graded") increment(gradedSubmissions, row.tenant_id);
  }
  for (const row of (noteResult.data ?? []) as TenantFact[]) {
    increment(notes, row.tenant_id);
    if (row.status === "active") increment(activeNotes, row.tenant_id);
  }
  for (const row of (timeResult.data ?? []) as TimeRow[]) {
    increment(
      learningSeconds,
      row.tenant_id,
      Math.max(0, Number(row.seconds ?? 0)),
    );
  }
  for (const row of scenarios) {
    increment(scenarioCounts, row.tenant_id);
    if (row.status === "published") increment(publishedScenarios, row.tenant_id);
  }
  for (const row of (conversationProgressResult.data ?? []) as ConversationProgressRow[]) {
    increment(conversationPractices, row.tenant_id);
    if (row.status === "completed") increment(completedConversationPractices, row.tenant_id);
  }

  const rows = tenants
    .map((tenant) => ({
      ...tenant,
      students: activeStudents.get(tenant.id) ?? 0,
      staff: activeStaff.get(tenant.id) ?? 0,
      assignments: assignmentCounts.get(tenant.id) ?? 0,
      publishedAssignments: publishedAssignments.get(tenant.id) ?? 0,
      submissions: submissions.get(tenant.id) ?? 0,
      gradedSubmissions: gradedSubmissions.get(tenant.id) ?? 0,
      notes: notes.get(tenant.id) ?? 0,
      activeNotes: activeNotes.get(tenant.id) ?? 0,
      learningHours: Math.round(((learningSeconds.get(tenant.id) ?? 0) / 3600) * 10) / 10,
      scenarios: scenarioCounts.get(tenant.id) ?? 0,
      publishedScenarios: publishedScenarios.get(tenant.id) ?? 0,
      conversationPractices: conversationPractices.get(tenant.id) ?? 0,
      completedConversationPractices: completedConversationPractices.get(tenant.id) ?? 0,
    }))
    .filter((row) =>
      row.students + row.staff + row.assignments + row.notes + row.learningHours + row.scenarios + row.conversationPractices > 0,
    );

  const hasError = Boolean(
    tenantResult.error ||
      enrollmentResult.error ||
      staffResult.error ||
      assignmentResult.error ||
      noteResult.error ||
      timeResult.error ||
      scenarioResult.error ||
      submissionResult.error ||
      conversationProgressResult.error,
  );
  const totals = rows.reduce(
    (sum, row) => ({
      students: sum.students + row.students,
      staff: sum.staff + row.staff,
      assignments: sum.assignments + row.assignments,
      submissions: sum.submissions + row.submissions,
      notes: sum.notes + row.notes,
      learningHours: sum.learningHours + row.learningHours,
      scenarios: sum.scenarios + row.scenarios,
      conversationPractices: sum.conversationPractices + row.conversationPractices,
    }),
    { students: 0, staff: 0, assignments: 0, submissions: 0, notes: 0, learningHours: 0, scenarios: 0, conversationPractices: 0 },
  );

  const columns = mode === "students"
    ? ["已授权学生", "应用员工", "教学任务", "学习记录"]
    : mode === "grades"
      ? ["教学任务", "已发布任务", "学生提交", "已批改提交"]
      : mode === "records"
        ? ["已授权学生", "有效学习时长", "人工辅导备注", "有效备注"]
        : ["会话场景", "已发布场景", "练习学生", "已完成练习"];

  return (
    <div className="space-y-4">
      <p className="app-muted-text text-xs leading-5">
        平台空间只显示“{access.appTitle}”的机构级汇总，不展示学生姓名、作答正文或辅导记录正文。
      </p>
      {hasError ? (
        <ManagementNotice tone="warning">
          部分应用汇总暂时无法读取，请检查数据库迁移和应用归属。
        </ManagementNotice>
      ) : null}
      <ManagementMetricStrip
        label="应用机构级运营概况"
        items={[
          { label: "覆盖机构", value: rows.length },
          { label: "授权学生", value: totals.students },
          { label: "应用员工", value: totals.staff },
          {
            label: mode === "conversation" ? "会话场景" : "教学任务",
            value: mode === "conversation" ? totals.scenarios : totals.assignments,
          },
          {
            label:
              mode === "records"
                ? "有效学习小时"
                : mode === "conversation"
                  ? "练习学生"
                  : "学生提交",
            value:
              mode === "records"
                ? totals.learningHours.toFixed(1)
                : mode === "conversation"
                  ? totals.conversationPractices
                  : totals.submissions,
          },
        ]}
      />
      <div className="overflow-x-auto border bg-[var(--app-card-bg)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">机构</th>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const values = mode === "students"
                ? [row.students, row.staff, row.assignments, row.notes]
                : mode === "grades"
                  ? [row.assignments, row.publishedAssignments, row.submissions, row.gradedSubmissions]
                  : mode === "records"
                    ? [row.students, `${row.learningHours.toFixed(1)} 小时`, row.notes, row.activeNotes]
                    : [row.scenarios, row.publishedScenarios, row.conversationPractices, row.completedConversationPractices];
              return <tr key={row.id} className="border-t border-[var(--app-border-soft)]"><td className="px-4 py-3 font-medium">{row.name}</td>{values.map((value, index) => <td key={columns[index]} className="px-4 py-3 tabular-nums">{value}</td>)}</tr>;
            })}
            {rows.length === 0 ? <tr><td colSpan={5} className="app-muted-text px-4 py-10 text-center">当前应用还没有机构级运营数据。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
