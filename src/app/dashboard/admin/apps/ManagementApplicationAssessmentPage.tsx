import Link from "next/link";

import {
  AssessmentPaperComposer,
  type PaperBankQuestion,
} from "@/app/dashboard/admin/assignments/AssessmentPaperComposer";
import { AssessmentPaperStatusActions } from "@/app/dashboard/admin/assignments/AssessmentPaperStatusActions";
import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import type { ManagementAppAccess } from "@/lib/management-apps";
import { questionOptions } from "@/lib/question-bank";
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
  korean_title: string;
  chapter_number: number;
  status: "draft" | "published" | "archived";
  passing_score: number;
  duration_minutes: number;
};
type BankQuestionRow = {
  id: string;
  test_id: string;
  question_type: "short_text" | "long_text" | "single_choice" | "file_link";
  prompt: string;
  options: unknown;
  skill: string;
  default_points: number;
  difficulty: string;
};
type PaperRow = {
  id: string;
  paper_code: string;
  title: string;
  paper_type: "homework" | "exam";
  status: "draft" | "published" | "retired" | "archived";
  question_count: number;
  total_points: number;
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
  const [assignmentResult, testResult, paperResult] = await Promise.all([
    access.tenantId
      ? assignmentQuery.order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    admin
      .from("chapter_tests")
      .select("id,title,korean_title,chapter_number,status,passing_score,duration_minutes")
      .eq("student_app_id", access.appId)
      .order("chapter_number", { ascending: true })
      .limit(100),
    admin
      .from("assessment_papers")
      .select("id,paper_code,title,paper_type,status,question_count,total_points")
      .eq("student_app_id", access.appId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  const assignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const tests = (testResult.data ?? []) as TestRow[];
  const papers = (paperResult.data ?? []) as PaperRow[];
  const canManageStandardPapers =
    access.scope === "platform" && access.capabilities.manageAssessments;
  const publishedTests = tests.filter((test) => test.status === "published");
  const bankQuestionResult =
    canManageStandardPapers && publishedTests.length > 0
      ? await admin
          .from("chapter_test_questions")
          .select(
            "id,test_id,question_type,prompt,options,skill,default_points,difficulty",
          )
          .in(
            "test_id",
            publishedTests.map((test) => test.id),
          )
          .eq("status", "published")
          .order("sort_order", { ascending: true })
      : { data: [] as BankQuestionRow[], error: null };
  const bankQuestions = (bankQuestionResult.data ?? []).map(
    (question): PaperBankQuestion => ({
      id: question.id,
      groupId: question.test_id,
      prompt: question.prompt,
      questionType: question.question_type,
      options: questionOptions(question.options),
      difficulty: question.difficulty,
      skill: question.skill,
      defaultPoints: Number(question.default_points),
    }),
  );
  const composerGroups = publishedTests.map((test) => ({
    id: test.id,
    title: test.title,
    koreanTitle: test.korean_title,
    chapterNumber: test.chapter_number,
  }));
  const homeworkCount = assignments.filter(
    (item) => item.assignment_type === "homework",
  ).length;
  const examCount = assignments.filter(
    (item) => item.assignment_type === "exam",
  ).length;

  return (
    <div className="space-y-5">
      {(assignmentResult.error || testResult.error || paperResult.error) && (
        <ManagementNotice tone="warning">
          作业考试数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}
      {bankQuestionResult.error && (
        <ManagementNotice tone="warning">
          标准题库暂时无法读取，新增试卷入口已暂停，请稍后刷新页面。
        </ManagementNotice>
      )}
      <ManagementMetricStrip
        label="作业与考试概况"
        items={[
          { label: "章节测试", value: tests.length },
          { label: "标准试卷", value: papers.length },
          { label: "老师作业", value: homeworkCount },
          { label: "正式考试", value: examCount },
          {
            label: "已发布任务",
            value: assignments.filter((item) => item.status === "published").length,
          },
        ]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold">平台标准试卷</h2><p className="app-muted-text mt-1 text-xs">不能跨应用发布。</p></div>
          {canManageStandardPapers && !testResult.error && !bankQuestionResult.error && (
            <div className="flex flex-wrap gap-2">
              <AssessmentPaperComposer
                paperType="homework"
                groups={composerGroups}
                questions={bankQuestions}
              />
              <AssessmentPaperComposer
                paperType="exam"
                groups={composerGroups}
                questions={bankQuestions}
              />
            </div>
          )}
        </div>
        <div className="overflow-x-auto border bg-[var(--card)]">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <caption className="sr-only">当前应用的平台标准试卷</caption>
            <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]"><tr><th className="px-4 py-3">编号</th><th className="px-4 py-3">试卷</th><th className="px-4 py-3">类型</th><th className="px-4 py-3">题量</th><th className="px-4 py-3">满分</th><th className="px-4 py-3">状态</th>{canManageStandardPapers && <th className="px-4 py-3">操作</th>}</tr></thead>
            <tbody>
              {papers.map((paper) => <tr key={paper.id} className="border-t border-[var(--border-subtle)]"><td className="app-muted-text px-4 py-3 font-mono">{paper.paper_code}</td><td className="px-4 py-3 font-medium">{paper.title}</td><td className="app-muted-text px-4 py-3">{paper.paper_type === "exam" ? "考试" : "作业"}</td><td className="px-4 py-3 tabular-nums">{paper.question_count}</td><td className="px-4 py-3 tabular-nums">{Number(paper.total_points)}</td><td className="px-4 py-3">{paper.status}</td>{canManageStandardPapers && <td className="px-4 py-3"><AssessmentPaperStatusActions paperId={paper.id} paperType={paper.paper_type} status={paper.status} /></td>}</tr>)}
              {papers.length === 0 && <tr><td colSpan={canManageStandardPapers ? 7 : 6} className="app-muted-text px-4 py-10 text-center">{paperResult.error ? "标准试卷读取失败，请稍后刷新重试。" : "当前应用还没有标准试卷。"}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">机构作业与正式考试</h2>
        <div className="overflow-x-auto border bg-[var(--card)]">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <caption className="sr-only">当前机构在此应用中的作业与正式考试</caption>
            <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]"><tr><th className="px-4 py-3">任务</th><th className="px-4 py-3">类型</th><th className="px-4 py-3">满分</th><th className="px-4 py-3">开始</th><th className="px-4 py-3">截止</th><th className="px-4 py-3">状态</th></tr></thead>
            <tbody>
              {assignments.map((item) => <tr key={item.id} className="border-t border-[var(--border-subtle)]"><td className="px-4 py-3 font-medium">{access.scope === "tenant" && access.capabilities.manageAssessments ? <Link href={`${access.appPath}/assignments/${item.id}`} className="hover:text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2">{item.title}</Link> : item.title}</td><td className="app-muted-text px-4 py-3">{assignmentLabels[item.assignment_type]}</td><td className="px-4 py-3 tabular-nums">{Number(item.total_points)}</td><td className="app-muted-text px-4 py-3">{dateTime(item.starts_at)}</td><td className="app-muted-text px-4 py-3">{dateTime(item.due_at)}</td><td className="px-4 py-3">{item.status}</td></tr>)}
              {assignments.length === 0 && <tr><td colSpan={6} className="app-muted-text px-4 py-10 text-center">{assignmentResult.error ? "机构作业与考试读取失败，请稍后刷新重试。" : "当前应用还没有机构作业或正式考试。"}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">章节测试目录</h2>
        <div className="overflow-x-auto border bg-[var(--card)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <caption className="sr-only">当前应用的章节测试目录</caption>
            <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]"><tr><th className="px-4 py-3">章节</th><th className="px-4 py-3">测试名称</th><th className="px-4 py-3">时长</th><th className="px-4 py-3">及格线</th><th className="px-4 py-3">状态</th></tr></thead>
            <tbody>
              {tests.map((test) => <tr key={test.id} className="border-t border-[var(--border-subtle)]"><td className="px-4 py-3 tabular-nums">第 {test.chapter_number} 章</td><td className="px-4 py-3 font-medium">{test.title}</td><td className="app-muted-text px-4 py-3">{test.duration_minutes} 分钟</td><td className="px-4 py-3 tabular-nums">{Number(test.passing_score)}</td><td className="px-4 py-3">{test.status}</td></tr>)}
              {tests.length === 0 && <tr><td colSpan={5} className="app-muted-text px-4 py-10 text-center">{testResult.error ? "章节测试读取失败，请稍后刷新重试。" : "当前应用还没有章节测试。"}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
