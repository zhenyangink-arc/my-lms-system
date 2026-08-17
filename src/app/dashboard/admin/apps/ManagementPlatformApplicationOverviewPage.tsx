import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import type { ManagementAppAccess } from "@/lib/management-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type OverviewMode = "students" | "grades" | "records" | "conversation";
type TenantRow = { id: string; name: string };
type TenantFact = { tenant_id: string; status?: string };
type AssignmentRow = { id: string; tenant_id: string; status: string };
type SubmissionRow = { tenant_id: string; status: string };
type TimeRow = { tenant_id: string; seconds: number | null };
type ScenarioRow = { id: string; tenant_id: string; status: string };
type ConversationProgressRow = { tenant_id: string; status: string };
type PlatformOverviewRpcRow = {
  tenant_id: string;
  tenant_name: string;
  active_students: number | string;
  active_staff: number | string;
  assignments: number | string;
  published_assignments: number | string;
  submissions: number | string;
  graded_submissions: number | string;
  notes: number | string;
  active_notes: number | string;
  scenarios: number | string;
  published_scenarios: number | string;
  conversation_practices: number | string;
  completed_conversation_practices: number | string;
};

type OverviewRow = {
  id: string;
  name: string;
  students: number;
  staff: number;
  assignments: number;
  publishedAssignments: number;
  submissions: number;
  gradedSubmissions: number;
  notes: number;
  activeNotes: number;
  learningHours: number;
  scenarios: number;
  publishedScenarios: number;
  conversationPractices: number;
  completedConversationPractices: number;
};

type QueryError = { message?: string } | null;
type PageResult = { data: unknown[] | null; error: QueryError };

const OVERVIEW_PAGE_SIZE = 1000;

function numeric(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<{ rows: T[]; error: QueryError }> {
  const rows: T[] = [];
  for (let from = 0; ; from += OVERVIEW_PAGE_SIZE) {
    const result = await loadPage(from, from + OVERVIEW_PAGE_SIZE - 1);
    if (result.error) return { rows, error: result.error };
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < OVERVIEW_PAGE_SIZE) return { rows, error: null };
  }
}

function normalizeRpcRows(rows: PlatformOverviewRpcRow[]): OverviewRow[] {
  return rows.map((row) => ({
    id: row.tenant_id,
    name: row.tenant_name,
    students: numeric(row.active_students),
    staff: numeric(row.active_staff),
    assignments: numeric(row.assignments),
    publishedAssignments: numeric(row.published_assignments),
    submissions: numeric(row.submissions),
    gradedSubmissions: numeric(row.graded_submissions),
    notes: numeric(row.notes),
    activeNotes: numeric(row.active_notes),
    learningHours: 0,
    scenarios: numeric(row.scenarios),
    publishedScenarios: numeric(row.published_scenarios),
    conversationPractices: numeric(row.conversation_practices),
    completedConversationPractices: numeric(
      row.completed_conversation_practices,
    ),
  }));
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

async function loadPagedLearningHours(appId: string): Promise<{
  rows: OverviewRow[];
  hasError: boolean;
}> {
  const admin = createAdminClient();
  const [tenantResult, timeResult] = await Promise.all([
    fetchAllRows<TenantRow>((from, to) =>
      admin
        .from("tenants")
        .select("id,name")
        .eq("status", "active")
        .order("name")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<TimeRow>((from, to) =>
      admin
        .from("learning_time_log")
        .select("tenant_id,seconds")
        .eq("student_app_id", appId)
        .order("id")
        .range(from, to),
    ),
  ]);
  const secondsByTenant = new Map<string, number>();
  for (const row of timeResult.rows) {
    increment(
      secondsByTenant,
      row.tenant_id,
      Math.max(0, Number(row.seconds ?? 0)),
    );
  }

  return {
    rows: tenantResult.rows.map((tenant) => ({
      ...tenant,
      students: 0,
      staff: 0,
      assignments: 0,
      publishedAssignments: 0,
      submissions: 0,
      gradedSubmissions: 0,
      notes: 0,
      activeNotes: 0,
      learningHours:
        Math.round(((secondsByTenant.get(tenant.id) ?? 0) / 3600) * 10) / 10,
      scenarios: 0,
      publishedScenarios: 0,
      conversationPractices: 0,
      completedConversationPractices: 0,
    })),
    hasError: Boolean(tenantResult.error || timeResult.error),
  };
}

async function loadPagedOverview(appId: string): Promise<{
  rows: OverviewRow[];
  hasError: boolean;
}> {
  const admin = createAdminClient();
  const [
    tenantResult,
    enrollmentResult,
    staffResult,
    assignmentResult,
    noteResult,
    timeResult,
    scenarioResult,
    submissionResult,
    conversationProgressResult,
  ] = await Promise.all([
    fetchAllRows<TenantRow>((from, to) =>
      admin
        .from("tenants")
        .select("id,name")
        .eq("status", "active")
        .order("name")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<TenantFact>((from, to) =>
      admin
        .from("student_app_enrollments")
        .select("tenant_id,status")
        .eq("app_id", appId)
        .order("tenant_id")
        .order("student_id")
        .range(from, to),
    ),
    fetchAllRows<TenantFact>((from, to) =>
      admin
        .from("staff_app_assignments")
        .select("tenant_id,status")
        .eq("app_id", appId)
        .order("tenant_id")
        .order("staff_id")
        .range(from, to),
    ),
    fetchAllRows<AssignmentRow>((from, to) =>
      admin
        .from("learning_assignments")
        .select("id,tenant_id,status")
        .eq("student_app_id", appId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<TenantFact>((from, to) =>
      admin
        .from("learning_record_notes")
        .select("tenant_id,status")
        .eq("student_app_id", appId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<TimeRow>((from, to) =>
      admin
        .from("learning_time_log")
        .select("tenant_id,seconds")
        .eq("student_app_id", appId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<ScenarioRow>((from, to) =>
      admin
        .from("conversation_practice_scenarios")
        .select("id,tenant_id,status")
        .eq("student_app_id", appId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<SubmissionRow>((from, to) =>
      admin
        .from("learning_submissions")
        .select(
          "tenant_id,status,assignment:learning_assignments!learning_submissions_assignment_id_fkey!inner(student_app_id)",
        )
        .eq("assignment.student_app_id", appId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<ConversationProgressRow>((from, to) =>
      admin
        .from("conversation_practice_progress")
        .select(
          "tenant_id,status,scenario:conversation_practice_scenarios!conversation_practice_progress_scenario_id_fkey!inner(student_app_id)",
        )
        .eq("scenario.student_app_id", appId)
        .order("user_id")
        .order("scenario_id")
        .range(from, to),
    ),
  ]);

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

  for (const row of enrollmentResult.rows) {
    if (row.status === "active") increment(activeStudents, row.tenant_id);
  }
  for (const row of staffResult.rows) {
    if (row.status === "active") increment(activeStaff, row.tenant_id);
  }
  for (const row of assignmentResult.rows) {
    increment(assignmentCounts, row.tenant_id);
    if (row.status === "published") {
      increment(publishedAssignments, row.tenant_id);
    }
  }
  for (const row of submissionResult.rows) {
    increment(submissions, row.tenant_id);
    if (row.status === "graded") increment(gradedSubmissions, row.tenant_id);
  }
  for (const row of noteResult.rows) {
    increment(notes, row.tenant_id);
    if (row.status === "active") increment(activeNotes, row.tenant_id);
  }
  for (const row of timeResult.rows) {
    increment(
      learningSeconds,
      row.tenant_id,
      Math.max(0, Number(row.seconds ?? 0)),
    );
  }
  for (const row of scenarioResult.rows) {
    increment(scenarioCounts, row.tenant_id);
    if (row.status === "published") {
      increment(publishedScenarios, row.tenant_id);
    }
  }
  for (const row of conversationProgressResult.rows) {
    increment(conversationPractices, row.tenant_id);
    if (row.status === "completed") {
      increment(completedConversationPractices, row.tenant_id);
    }
  }

  const rows = tenantResult.rows
    .map((tenant): OverviewRow => ({
      ...tenant,
      students: activeStudents.get(tenant.id) ?? 0,
      staff: activeStaff.get(tenant.id) ?? 0,
      assignments: assignmentCounts.get(tenant.id) ?? 0,
      publishedAssignments: publishedAssignments.get(tenant.id) ?? 0,
      submissions: submissions.get(tenant.id) ?? 0,
      gradedSubmissions: gradedSubmissions.get(tenant.id) ?? 0,
      notes: notes.get(tenant.id) ?? 0,
      activeNotes: activeNotes.get(tenant.id) ?? 0,
      learningHours:
        Math.round(((learningSeconds.get(tenant.id) ?? 0) / 3600) * 10) / 10,
      scenarios: scenarioCounts.get(tenant.id) ?? 0,
      publishedScenarios: publishedScenarios.get(tenant.id) ?? 0,
      conversationPractices: conversationPractices.get(tenant.id) ?? 0,
      completedConversationPractices:
        completedConversationPractices.get(tenant.id) ?? 0,
    }))
    .filter(
      (row) =>
        row.students +
          row.staff +
          row.assignments +
          row.notes +
          row.learningHours +
          row.scenarios +
          row.conversationPractices >
        0,
    );
  const hasError = [
    tenantResult,
    enrollmentResult,
    staffResult,
    assignmentResult,
    noteResult,
    timeResult,
    scenarioResult,
    submissionResult,
    conversationProgressResult,
  ].some((result) => Boolean(result.error));

  return { rows, hasError };
}

export async function ManagementPlatformApplicationOverviewPage({
  access,
  mode,
}: {
  access: ManagementAppAccess;
  mode: OverviewMode;
}) {
  let rows: OverviewRow[];
  let hasError = false;

  if (access.role === "platform_super_admin") {
    const supabase = await createClient();
    const [rpcResult, learningTimeResult] = await Promise.all([
      supabase.rpc("get_platform_management_app_overview", {
        p_app_id: access.appId,
      }),
      loadPagedLearningHours(access.appId),
    ]);
    if (rpcResult.error) {
      const fallback = await loadPagedOverview(access.appId);
      rows = fallback.rows;
      hasError = fallback.hasError;
    } else {
      const rowByTenant = new Map(
        normalizeRpcRows(
          (rpcResult.data ?? []) as PlatformOverviewRpcRow[],
        ).map((row) => [row.id, row]),
      );
      for (const timeRow of learningTimeResult.rows) {
        const row = rowByTenant.get(timeRow.id) ?? timeRow;
        row.learningHours = timeRow.learningHours;
        if (
          row.students +
            row.staff +
            row.assignments +
            row.notes +
            row.learningHours +
            row.scenarios +
            row.conversationPractices >
          0
        ) {
          rowByTenant.set(row.id, row);
        }
      }
      rows = [...rowByTenant.values()].sort(
        (left, right) =>
          left.name.localeCompare(right.name, "zh-CN") ||
          left.id.localeCompare(right.id),
      );
      hasError = learningTimeResult.hasError;
    }
  } else {
    // 平台副负责人现有权限依赖服务端显式授权；SECURITY INVOKER RPC
    // 不扩大其数据库直连权限，因此保留完整分页的兼容路径。
    const fallback = await loadPagedOverview(access.appId);
    rows = fallback.rows;
    hasError = fallback.hasError;
  }
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
          部分应用汇总暂时无法读取，请稍后刷新页面重试；当前结果可能不完整。
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
      <div className="overflow-x-auto border bg-[var(--card)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <caption className="sr-only">{access.appTitle}机构级运营数据</caption>
          <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]"><tr><th scope="col" className="px-4 py-3">机构</th>{columns.map((column) => <th key={column} scope="col" className="px-4 py-3">{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const values = mode === "students"
                ? [row.students, row.staff, row.assignments, row.notes]
                : mode === "grades"
                  ? [row.assignments, row.publishedAssignments, row.submissions, row.gradedSubmissions]
                  : mode === "records"
                    ? [row.students, `${row.learningHours.toFixed(1)} 小时`, row.notes, row.activeNotes]
                    : [row.scenarios, row.publishedScenarios, row.conversationPractices, row.completedConversationPractices];
              return <tr key={row.id} className="border-t border-[var(--border-subtle)]"><td className="px-4 py-3 font-medium">{row.name}</td>{values.map((value, index) => <td key={columns[index]} className="px-4 py-3 tabular-nums">{value}</td>)}</tr>;
            })}
            {rows.length === 0 ? <tr><td colSpan={5} className="app-muted-text px-4 py-10 text-center">{hasError ? "暂时没有可显示的机构级运营数据，请先处理上方读取异常后重试。" : "当前应用还没有机构级运营数据。"}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
