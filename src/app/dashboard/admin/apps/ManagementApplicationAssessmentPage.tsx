import Link from "next/link";

import {
  AssessmentPaperComposer,
  type PaperBankQuestion,
} from "@/app/dashboard/admin/assignments/AssessmentPaperComposer";
import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { requireActiveUser } from "@/lib/auth";
import type { ManagementAppAccess } from "@/lib/management-apps";
import { questionOptions } from "@/lib/question-bank";
import {
  PlatformAssessmentPaperCatalog,
  type PlatformAssessmentPaperItem,
} from "./PlatformAssessmentPaperCatalog";

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
  source_test_id: string;
  question_count: number;
  total_points: number;
  version: number;
  updated_at: string;
};
type PaperQuestionRow = {
  id: string;
  paper_id: string;
  prompt: string;
  options: unknown;
  points: number;
  difficulty: string;
  skill: string;
  sort_order: number;
};
type PaperQuality = {
  ready?: boolean;
  issues?: unknown;
};
type PaperAdoption = {
  paper_id: string;
  institution_count: number;
  assignment_count: number;
};

const assignmentLabels = {
  homework: "老师作业",
  quiz: "测验",
  exam: "正式考试",
} as const;

const assignmentStatusLabels = {
  draft: "草稿",
  published: "进行中",
  closed: "已结束",
} as const;

const testStatusLabels = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
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
  const { supabase } = await requireActiveUser();
  const canPrepareStandardPapers =
    access.scope === "platform" && access.capabilities.manageAssessments;
  const canReleaseStandardPapers =
    canPrepareStandardPapers && access.globalRole === "platform_owner";

  let assignmentQuery = supabase
    .from("learning_assignments")
    .select("id,title,assignment_type,status,total_points,starts_at,due_at")
    .eq("student_app_id", access.appId);
  if (access.tenantId) {
    assignmentQuery = assignmentQuery.eq("tenant_id", access.tenantId);
  }

  let paperQuery = supabase
    .from("assessment_papers")
    .select(
      "id,paper_code,title,paper_type,status,source_test_id,question_count,total_points,version,updated_at"
    )
    .eq("student_app_id", access.appId);
  if (access.scope === "tenant") {
    paperQuery = paperQuery.eq("status", "published");
  }

  const [assignmentResult, testResult, paperResult] = await Promise.all([
    access.tenantId
      ? assignmentQuery.order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    supabase
      .from("chapter_tests")
      .select(
        "id,title,korean_title,chapter_number,status,passing_score,duration_minutes"
      )
      .eq("student_app_id", access.appId)
      .order("chapter_number", { ascending: true })
      .limit(100),
    paperQuery.order("updated_at", { ascending: false }).limit(100),
  ]);
  const assignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const tests = (testResult.data ?? []) as TestRow[];
  const papers = (paperResult.data ?? []) as PaperRow[];
  const publishedTests = tests.filter((test) => test.status === "published");

  const [bankQuestionResult, paperQuestionResult, adoptionResult] =
    await Promise.all([
      canPrepareStandardPapers && publishedTests.length > 0
        ? supabase
            .from("chapter_test_questions")
            .select(
              "id,test_id,question_type,prompt,options,skill,default_points,difficulty"
            )
            .in(
              "test_id",
              publishedTests.map((test) => test.id)
            )
            .eq("status", "published")
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] as BankQuestionRow[], error: null }),
      canPrepareStandardPapers && papers.length > 0
        ? supabase
            .from("assessment_paper_questions")
            .select(
              "id,paper_id,prompt,options,points,difficulty,skill,sort_order"
            )
            .in(
              "paper_id",
              papers.map((paper) => paper.id)
            )
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] as PaperQuestionRow[], error: null }),
      canPrepareStandardPapers
        ? supabase.rpc("get_platform_assessment_paper_adoption_counts", {
            p_student_app_id: access.appId,
          })
        : Promise.resolve({ data: [] as PaperAdoption[], error: null }),
    ]);

  const qualityEntries = canPrepareStandardPapers
    ? await Promise.all(
        papers.map(async (paper) => {
          const qualityResult = await supabase.rpc(
            "get_assessment_paper_release_quality",
            { p_paper_id: paper.id }
          );
          return [
            paper.id,
            qualityResult.error
              ? null
              : (qualityResult.data as PaperQuality | null),
          ] as const;
        })
      )
    : [];
  const qualityByPaperId = new Map(qualityEntries);
  const adoptionByPaperId = new Map(
    ((adoptionResult.data ?? []) as PaperAdoption[]).map((item) => [
      item.paper_id,
      item,
    ])
  );
  const testById = new Map(tests.map((test) => [test.id, test]));
  const questionsByPaperId = new Map<string, PaperQuestionRow[]>();
  ((paperQuestionResult.data ?? []) as PaperQuestionRow[]).forEach((question) => {
    const current = questionsByPaperId.get(question.paper_id) ?? [];
    current.push(question);
    questionsByPaperId.set(question.paper_id, current);
  });

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
    })
  );
  const composerGroups = publishedTests.map((test) => ({
    id: test.id,
    title: test.title,
    koreanTitle: test.korean_title,
    chapterNumber: test.chapter_number,
  }));
  const platformCatalogPapers: PlatformAssessmentPaperItem[] = papers.map(
    (paper) => {
      const test = testById.get(paper.source_test_id);
      const adoption = adoptionByPaperId.get(paper.id);
      const quality = qualityByPaperId.get(paper.id);
      const qualityIssues = Array.isArray(quality?.issues)
        ? quality.issues.filter(
            (issue): issue is string => typeof issue === "string"
          )
        : ["质检结果读取失败，请刷新后重试。"];
      return {
        id: paper.id,
        paperCode: paper.paper_code,
        title: paper.title,
        paperType: paper.paper_type,
        status: paper.status,
        chapterTitle: test
          ? `第 ${test.chapter_number} 章 · ${test.title}`
          : "综合题库",
        questionCount: paper.question_count,
        totalPoints: Number(paper.total_points),
        version: paper.version,
        updatedAt: paper.updated_at,
        qualityReady: quality?.ready === true,
        qualityIssues,
        institutionCount: Number(adoption?.institution_count ?? 0),
        assignmentCount: Number(adoption?.assignment_count ?? 0),
        questions: (questionsByPaperId.get(paper.id) ?? []).map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: questionOptions(question.options),
          points: Number(question.points),
          difficulty: question.difficulty,
          skill: question.skill,
        })),
      };
    }
  );

  const homeworkCount = assignments.filter(
    (item) => item.assignment_type === "homework"
  ).length;
  const examCount = assignments.filter(
    (item) => item.assignment_type === "exam"
  ).length;
  const totalAdoptions = platformCatalogPapers.reduce(
    (sum, paper) => sum + paper.assignmentCount,
    0
  );
  const readError =
    assignmentResult.error || testResult.error || paperResult.error;

  return (
    <div className="space-y-5">
      {readError && (
        <ManagementNotice tone="warning">
          作业考试数据暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}
      {(bankQuestionResult.error || paperQuestionResult.error) && (
        <ManagementNotice tone="warning">
          标准题库或试卷题目暂时无法完整读取，请稍后刷新页面。
        </ManagementNotice>
      )}

      {access.scope === "platform" ? (
        <>
          <ManagementNotice tone="info">
            {canReleaseStandardPapers
              ? "您可以审核并发布标准作业卷和考试卷。发布后，已开通此应用且有测评权限的机构才能看到整卷。"
              : "您可以准备和完善标准试卷草稿；只有平台负责人完成最终发布后，机构端才会看到。"}
          </ManagementNotice>
          <ManagementMetricStrip
            label="标准试卷发布概况"
            items={[
              {
                label: "待完善",
                value: papers.filter((paper) => paper.status === "draft").length,
              },
              {
                label: "机构可用",
                value: papers.filter((paper) => paper.status === "published")
                  .length,
              },
              {
                label: "已停止提供",
                value: papers.filter((paper) => paper.status === "retired")
                  .length,
              },
              { label: "机构布置次数", value: totalAdoptions },
            ]}
          />

          <section className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">制作标准试卷</h2>
                <p className="app-muted-text mt-1 text-xs">
                  内容管理员可以保存草稿；直接发布只向平台负责人开放。
                </p>
              </div>
              {canPrepareStandardPapers &&
                !testResult.error &&
                !bankQuestionResult.error && (
                  <div className="flex flex-wrap gap-2">
                    <AssessmentPaperComposer
                      paperType="homework"
                      canPublish={canReleaseStandardPapers}
                      groups={composerGroups}
                      questions={bankQuestions}
                    />
                    <AssessmentPaperComposer
                      paperType="exam"
                      canPublish={canReleaseStandardPapers}
                      groups={composerGroups}
                      questions={bankQuestions}
                    />
                  </div>
                )}
            </div>
            <PlatformAssessmentPaperCatalog
              papers={platformCatalogPapers}
              canRelease={canReleaseStandardPapers}
            />
          </section>
        </>
      ) : (
        <>
          <ManagementNotice tone="info">
            这里仅显示平台负责人已经正式发布的整套试卷。机构不能修改平台题目，可以前往作业考试管理选择学生和时间进行布置。
          </ManagementNotice>
          <ManagementMetricStrip
            label="机构作业与考试概况"
            items={[
              { label: "平台可用试卷", value: papers.length },
              { label: "老师作业", value: homeworkCount },
              { label: "正式考试", value: examCount },
              {
                label: "进行中任务",
                value: assignments.filter((item) => item.status === "published")
                  .length,
              },
            ]}
          />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">平台已发布试卷</h2>
                <p className="app-muted-text mt-1 text-xs">
                  机构端只接收平台正式发布的版本。
                </p>
              </div>
              {access.capabilities.manageAssessments && (
                <Link
                  href={`${access.dashboardBasePath}/admin/assignments`}
                  className="inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  去布置作业或考试
                </Link>
              )}
            </div>
            <div className="overflow-x-auto border bg-[var(--card)]">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <caption className="sr-only">平台已向机构发布的试卷</caption>
                <thead className="bg-[var(--surface-soft)] app-muted-text">
                  <tr>
                    <th className="px-4 py-3">试卷</th>
                    <th className="px-4 py-3">类型</th>
                    <th className="px-4 py-3">来源章节</th>
                    <th className="px-4 py-3">题量</th>
                    <th className="px-4 py-3">满分</th>
                    <th className="px-4 py-3">版本</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map((paper) => {
                    const test = testById.get(paper.source_test_id);
                    return (
                      <tr
                        key={paper.id}
                        className="border-t border-[var(--border-subtle)]"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{paper.title}</p>
                          <p className="app-muted-text mt-1 font-mono text-[10px]">
                            {paper.paper_code}
                          </p>
                        </td>
                        <td className="app-muted-text px-4 py-3">
                          {paper.paper_type === "exam" ? "考试卷" : "作业卷"}
                        </td>
                        <td className="px-4 py-3">
                          {test ? `第 ${test.chapter_number} 章` : "综合题库"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {paper.question_count}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {Number(paper.total_points)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          版本 {paper.version}
                        </td>
                      </tr>
                    );
                  })}
                  {papers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="app-muted-text px-4 py-10 text-center">
                        {paperResult.error
                          ? "标准试卷读取失败，请稍后刷新重试。"
                          : "平台暂时还没有发布可供机构使用的试卷。"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">本机构布置记录</h2>
            <div className="overflow-x-auto border bg-[var(--card)]">
              <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                <caption className="sr-only">当前机构在此应用中的作业与正式考试</caption>
                <thead className="bg-[var(--surface-soft)] app-muted-text">
                  <tr>
                    <th className="px-4 py-3">任务</th>
                    <th className="px-4 py-3">类型</th>
                    <th className="px-4 py-3">满分</th>
                    <th className="px-4 py-3">开始</th>
                    <th className="px-4 py-3">截止</th>
                    <th className="px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[var(--border-subtle)]"
                    >
                      <td className="px-4 py-3 font-medium">
                        {access.capabilities.manageAssessments ? (
                          <Link
                            href={`${access.dashboardBasePath}/admin/assignments/${item.id}`}
                            className="hover:text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </td>
                      <td className="app-muted-text px-4 py-3">
                        {assignmentLabels[item.assignment_type]}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {Number(item.total_points)}
                      </td>
                      <td className="app-muted-text px-4 py-3">
                        {dateTime(item.starts_at)}
                      </td>
                      <td className="app-muted-text px-4 py-3">
                        {dateTime(item.due_at)}
                      </td>
                      <td className="px-4 py-3">
                        {assignmentStatusLabels[item.status]}
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="app-muted-text px-4 py-10 text-center">
                        {assignmentResult.error
                          ? "机构作业与考试读取失败，请稍后刷新重试。"
                          : "当前应用还没有机构作业或正式考试。"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">章节测试目录</h2>
        <div className="overflow-x-auto border bg-[var(--card)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <caption className="sr-only">当前应用的章节测试目录</caption>
            <thead className="bg-[var(--surface-soft)] app-muted-text">
              <tr>
                <th className="px-4 py-3">章节</th>
                <th className="px-4 py-3">测试名称</th>
                <th className="px-4 py-3">时长</th>
                <th className="px-4 py-3">及格线</th>
                <th className="px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr
                  key={test.id}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="px-4 py-3 tabular-nums">
                    第 {test.chapter_number} 章
                  </td>
                  <td className="px-4 py-3 font-medium">{test.title}</td>
                  <td className="app-muted-text px-4 py-3">
                    {test.duration_minutes} 分钟
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {Number(test.passing_score)}
                  </td>
                  <td className="px-4 py-3">
                    {testStatusLabels[test.status]}
                  </td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr>
                  <td colSpan={5} className="app-muted-text px-4 py-10 text-center">
                    {testResult.error
                      ? "章节测试读取失败，请稍后刷新重试。"
                      : "当前应用还没有章节测试。"}
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
