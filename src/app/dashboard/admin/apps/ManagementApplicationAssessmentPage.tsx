import type { ManagementAppAccess } from "@/lib/management-apps";
import { createAdminClient } from "@/lib/supabase/admin";

type AssignmentRow = {
  id: string;
  title: string;
  assignment_type: "homework" | "quiz" | "exam";
  status: "draft" | "published" | "closed";
  total_points: number;
  starts_at: string | null;
  due_at: string;
};
type TestRow = {
  id: string;
  title: string;
  chapter_number: number;
  status: "draft" | "published" | "archived";
  passing_score: number;
  duration_minutes: number;
};

const assignmentLabels = {
  homework: "老师作业",
  quiz: "测验",
  exam: "正式考试",
} as const;

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function ManagementApplicationAssessmentPage({
  access,
}: {
  access: ManagementAppAccess;
}) {
  const admin = createAdminClient();
  let assignmentQuery = admin
    .from("learning_assignments")
    .select("id,title,assignment_type,status,total_points,starts_at,due_at")
    .eq("student_app_id", access.appId);
  if (access.tenantId) {
    assignmentQuery = assignmentQuery.eq("tenant_id", access.tenantId);
  }
  const [assignmentResult, testResult] = await Promise.all([
    assignmentQuery.order("created_at", { ascending: false }).limit(100),
    admin
      .from("chapter_tests")
      .select("id,title,chapter_number,status,passing_score,duration_minutes")
      .eq("student_app_id", access.appId)
      .order("chapter_number", { ascending: true })
      .limit(100),
  ]);
  const assignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const tests = (testResult.data ?? []) as TestRow[];
  const homeworkCount = assignments.filter(
    (item) => item.assignment_type === "homework",
  ).length;
  const examCount = assignments.filter(
    (item) => item.assignment_type === "exam",
  ).length;

  return (
    <div className="space-y-5">
      {(assignmentResult.error || testResult.error) && (
        <p className="border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          作业考试数据暂时无法完整读取，请确认应用归属迁移已经部署。
        </p>
      )}
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[680px] border-collapse text-left">
            <thead><tr><th>章节测试</th><th>老师作业</th><th>正式考试</th><th>其他测验</th><th>已发布任务</th></tr></thead>
            <tbody><tr><td>{tests.length}</td><td>{homeworkCount}</td><td>{examCount}</td><td>{assignments.length - homeworkCount - examCount}</td><td>{assignments.filter((item) => item.status === "published").length}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-sm font-semibold">机构作业与正式考试</h2><p className="app-muted-text mt-1 text-xs">列表由 `learning_assignments.student_app_id` 直接限定。</p></div>
        <div className="overflow-x-auto border bg-[var(--app-card-bg)]">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">任务</th><th className="px-4 py-3">类型</th><th className="px-4 py-3">满分</th><th className="px-4 py-3">开始</th><th className="px-4 py-3">截止</th><th className="px-4 py-3">状态</th></tr></thead>
            <tbody>
              {assignments.map((item) => <tr key={item.id} className="border-t border-[var(--app-border-soft)]"><td className="px-4 py-3 font-medium">{item.title}</td><td className="app-muted-text px-4 py-3">{assignmentLabels[item.assignment_type]}</td><td className="px-4 py-3 tabular-nums">{Number(item.total_points)}</td><td className="app-muted-text px-4 py-3">{dateTime(item.starts_at)}</td><td className="app-muted-text px-4 py-3">{dateTime(item.due_at)}</td><td className="px-4 py-3">{item.status}</td></tr>)}
              {assignments.length === 0 && <tr><td colSpan={6} className="app-muted-text px-4 py-10 text-center">当前应用还没有机构作业或正式考试。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-sm font-semibold">章节测试目录</h2><p className="app-muted-text mt-1 text-xs">章节测试与其他应用的测试题库完全分开。</p></div>
        <div className="overflow-x-auto border bg-[var(--app-card-bg)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">章节</th><th className="px-4 py-3">测试名称</th><th className="px-4 py-3">时长</th><th className="px-4 py-3">及格线</th><th className="px-4 py-3">状态</th></tr></thead>
            <tbody>
              {tests.map((test) => <tr key={test.id} className="border-t border-[var(--app-border-soft)]"><td className="px-4 py-3 tabular-nums">第 {test.chapter_number} 章</td><td className="px-4 py-3 font-medium">{test.title}</td><td className="app-muted-text px-4 py-3">{test.duration_minutes} 分钟</td><td className="px-4 py-3 tabular-nums">{Number(test.passing_score)}</td><td className="px-4 py-3">{test.status}</td></tr>)}
              {tests.length === 0 && <tr><td colSpan={5} className="app-muted-text px-4 py-10 text-center">当前应用还没有章节测试。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
