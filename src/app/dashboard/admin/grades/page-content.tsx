import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Database,
  SearchCheck,
  XCircle,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import {
  GRADE_REVIEW_STATUS_LABELS,
  gradeDateFormatter,
  gradeLevel,
  type GradeReviewStatus,
} from "@/app/dashboard/grades/config";
import { ASSIGNMENT_TYPE_LABELS } from "@/app/dashboard/assignments/config";
import { requireGradeCenterOverviewAccess } from "@/lib/grade-center";
import { createAdminClient } from "@/lib/supabase/admin";
import { GradeReviewManager } from "./GradeReviewManager";
import {
  PlatformGradeOverview,
  type PlatformGradeOverviewRow,
} from "./PlatformGradeOverview";

type AssignmentRow = {
  id: string;
  title: string;
  assignment_type: "homework" | "quiz" | "exam";
  total_points: number;
  course_id: string | null;
  status: "published" | "closed";
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  score: number;
  overall_feedback: string | null;
  graded_at: string | null;
  submitted_at: string;
  attempt_number: number;
};

type ChapterTestRow = {
  id: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
  passing_score: number;
};

type ChapterAttemptRow = {
  id: string;
  student_id: string;
  test_slug: string;
  score: number;
  correct_count: number;
  total_questions: number;
  passed: boolean;
  attempted_at: string;
};

type ReviewRow = {
  id: string;
  record_id: string | null;
  student_id: string;
  source_type:
    | "manual_grade_record"
    | "assignment_submission"
    | "chapter_test_attempt";
  source_result_id: string | null;
  source_title: string;
  source_score: number | null;
  source_total_points: number | null;
  source_context: Record<string, unknown> | null;
  reason: string;
  status: GradeReviewStatus;
  response: string;
  requested_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CourseRow = { id: string; title: string };

type ResultRow = {
  key: string;
  sourceType: "assignment_submission" | "chapter_test_attempt";
  sourceResultId: string;
  sourceId: string;
  studentId: string;
  courseName: string;
  title: string;
  typeLabel: string;
  score: number;
  totalPoints: number;
  detail: string;
  resultLabel: string;
  passed: boolean;
  recordedAt: string;
  href: string;
};

const COURSE_KEY_LABELS: Record<string, string> = {
  "hangul-introduction": "韩语字母入门",
  "korean-level-one": "韩国语1级",
  "korean-level-two": "韩国语2级",
};

function sourceTypeLabel(sourceType: ReviewRow["source_type"]) {
  if (sourceType === "assignment_submission") return "作业／考试";
  if (sourceType === "chapter_test_attempt") return "章节测试";
  return "历史成绩";
}

function reviewTone(status: GradeReviewStatus) {
  if (status === "resolved") {
    return {
      color: "var(--app-success)",
      background: "var(--app-success-soft)",
    };
  }
  if (status === "rejected") {
    return {
      color: "var(--app-muted)",
      background: "var(--app-soft-bg)",
    };
  }
  return {
    color: "var(--app-warm)",
    background: "var(--app-warm-soft)",
  };
}

export default async function GradeManagementPage() {
  const access = await requireGradeCenterOverviewAccess();
  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc(
      "get_platform_grade_overview",
    );
    return (
      <PlatformGradeOverview
        rows={(data ?? []) as PlatformGradeOverviewRow[]}
        hasError={Boolean(error)}
      />
    );
  }

  const { supabase, role, tenantId } = access;
  const admin = createAdminClient();

  const [
    assignmentsResult,
    submissionsResult,
    attemptsResult,
    reviewsResult,
    testsResult,
    coursesResult,
  ] = await Promise.all([
    supabase
      .from("learning_assignments")
      .select("id,title,assignment_type,total_points,course_id,status")
      .eq("tenant_id", tenantId)
      .in("status", ["published", "closed"])
      .order("created_at", { ascending: false }),
    supabase
      .from("learning_submissions")
      .select(
        "id,assignment_id,student_id,score,overall_feedback,graded_at,submitted_at,attempt_number",
      )
      .eq("tenant_id", tenantId)
      .eq("status", "graded")
      .not("score", "is", null)
      .order("attempt_number", { ascending: false }),
    supabase
      .from("chapter_test_attempts")
      .select(
        "id,student_id,test_slug,score,correct_count,total_questions,passed,attempted_at",
      )
      .eq("tenant_id", tenantId)
      .order("attempted_at", { ascending: false }),
    supabase
      .from("grade_review_requests")
      .select(
        "id,record_id,student_id,source_type,source_result_id,source_title,source_score,source_total_points,source_context,reason,status,response,requested_at",
      )
      .eq("tenant_id", tenantId)
      .order("requested_at", { ascending: false }),
    admin
      .from("chapter_tests")
      .select(
        "id,slug,course_key,chapter_number,title,korean_title,passing_score",
      )
      .eq("status", "published")
      .order("course_key")
      .order("chapter_number"),
    supabase
      .from("courses")
      .select("id,title")
      .eq("tenant_id", tenantId)
      .order("title", { ascending: true }),
  ]);

  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const attempts = (attemptsResult.data ?? []) as ChapterAttemptRow[];
  const reviews = (reviewsResult.data ?? []) as ReviewRow[];
  const tests = (testsResult.data ?? []) as ChapterTestRow[];
  const courses = (coursesResult.data ?? []) as CourseRow[];

  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
  const testBySlug = new Map(tests.map((test) => [test.slug, test]));
  const courseNameById = new Map(
    courses.map((course) => [course.id, course.title]),
  );

  const latestSubmissions = new Map<string, SubmissionRow>();
  for (const submission of submissions) {
    const key = `${submission.assignment_id}:${submission.student_id}`;
    if (!latestSubmissions.has(key)) latestSubmissions.set(key, submission);
  }

  const results: ResultRow[] = [];
  for (const submission of latestSubmissions.values()) {
    const assignment = assignmentById.get(submission.assignment_id);
    if (!assignment) continue;
    const percent = assignment.total_points
      ? (Number(submission.score) / Number(assignment.total_points)) * 100
      : 0;
    results.push({
      key: `assignment:${submission.id}`,
      sourceType: "assignment_submission",
      sourceResultId: submission.id,
      sourceId: assignment.id,
      studentId: submission.student_id,
      courseName: assignment.course_id
        ? courseNameById.get(assignment.course_id) ?? "关联课程"
        : "综合任务",
      title: assignment.title,
      typeLabel: ASSIGNMENT_TYPE_LABELS[assignment.assignment_type],
      score: Number(submission.score),
      totalPoints: Number(assignment.total_points),
      detail: `第 ${submission.attempt_number} 次提交`,
      resultLabel: gradeLevel(percent),
      passed: percent >= 60,
      recordedAt: submission.graded_at ?? submission.submitted_at,
      href: `/dashboard/admin/assignments/${assignment.id}`,
    });
  }

  for (const attempt of attempts) {
    const test = testBySlug.get(attempt.test_slug);
    if (!test) continue;
    results.push({
      key: `chapter:${attempt.id}`,
      sourceType: "chapter_test_attempt",
      sourceResultId: attempt.id,
      sourceId: test.id,
      studentId: attempt.student_id,
      courseName:
        COURSE_KEY_LABELS[test.course_key] ?? test.course_key ?? "章节课程",
      title: `第 ${test.chapter_number} 章 · ${test.title}`,
      typeLabel: "章节测试",
      score: Number(attempt.score),
      totalPoints: 100,
      detail: `${attempt.correct_count} / ${attempt.total_questions} 题`,
      resultLabel: attempt.passed ? "已通过" : "未通过",
      passed: attempt.passed,
      recordedAt: attempt.attempted_at,
      href: `/dashboard/assignments/korean/${test.slug}`,
    });
  }

  results.sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const studentIds = [
    ...new Set([
      ...results.map((result) => result.studentId),
      ...reviews.map((review) => review.student_id),
    ]),
  ];
  const { data: profileData } = studentIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", studentIds)
    : { data: [] as ProfileRow[] };
  const studentNameById = new Map(
    ((profileData ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.full_name?.trim() || profile.email || "学生",
    ]),
  );

  const reviewBySource = new Map(
    reviews
      .filter((review) => review.source_result_id)
      .map((review) => [
        `${review.source_type}:${review.source_result_id}`,
        review,
      ]),
  );
  const resultBySource = new Map(
    results.map((result) => [
      `${result.sourceType}:${result.sourceResultId}`,
      result,
    ]),
  );
  const resultCountBySource = new Map<string, number>();
  for (const result of results) {
    const key = `${result.sourceType}:${result.sourceId}`;
    resultCountBySource.set(key, (resultCountBySource.get(key) ?? 0) + 1);
  }

  const pendingReviews = reviews.filter(
    (review) => review.status === "pending" || review.status === "reviewing",
  ).length;
  const dataError =
    assignmentsResult.error ||
    submissionsResult.error ||
    attemptsResult.error ||
    reviewsResult.error ||
    testsResult.error ||
    coursesResult.error;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1600px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{ backgroundColor: "var(--app-card-bg)" }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-center">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <Database size={14} />
                {role === "admin" ? "成绩管理权限" : "成绩数据总览"}
              </span>
              <DashboardTitleWithHint
                className="mt-3"
                title="成绩汇总与复核"
                description="实时读取作业、考试批改结果和章节测试成绩；不再新建或复制成绩项目。"
              />
            </div>
            <div className="dashboard-title-metrics">
              {[
                [
                  "成绩来源",
                  assignments.length + tests.length,
                  BookOpenCheck,
                  "var(--app-secondary)",
                  "var(--app-secondary-soft)",
                ],
                [
                  "有效成绩",
                  results.length,
                  ClipboardCheck,
                  "var(--app-success)",
                  "var(--app-success-soft)",
                ],
                [
                  "复核处理中",
                  pendingReviews,
                  SearchCheck,
                  "var(--app-warm)",
                  "var(--app-warm-soft)",
                ],
              ].map(([label, value, Icon, color, soft]) => {
                const MetricIcon = Icon as typeof Database;
                return (
                  <div
                    key={String(label)}
                    className="app-soft-card rounded-2xl border p-4 text-center"
                  >
                    <MetricIcon
                      className="mx-auto"
                      size={18}
                      style={{ color: String(color) }}
                    />
                    <p className="mt-2 text-2xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-xs font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {dataError && (
          <section
            className="rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            部分成绩数据暂时无法读取，请确认最新数据库迁移已经执行。
          </section>
        )}

        <section className="app-card overflow-hidden rounded-3xl border">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div>
              <h2 className="text-base font-black">实时成绩明细</h2>
              <p className="app-muted-text mt-1 text-[11px]">
                同一作业仅显示每位学生最近一次已批改提交；章节测试显示覆盖后的当前成绩。
              </p>
            </div>
            <span className="app-muted-text text-xs font-black">
              共 {results.length} 条
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[13%] px-5 py-3 font-black">学生</th>
                  <th className="w-[16%] px-3 py-3 font-black">课程</th>
                  <th className="w-[25%] px-3 py-3 font-black">考核内容</th>
                  <th className="w-[13%] px-3 py-3 font-black">成绩</th>
                  <th className="w-[11%] px-3 py-3 font-black">结果</th>
                  <th className="w-[12%] px-3 py-3 font-black">记录时间</th>
                  <th className="w-[10%] px-5 py-3 font-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const review = reviewBySource.get(
                    `${result.sourceType}:${result.sourceResultId}`,
                  );
                  const percent = result.totalPoints
                    ? (result.score / result.totalPoints) * 100
                    : 0;
                  return (
                    <tr
                      key={result.key}
                      className="border-b align-top text-[11px] last:border-b-0"
                      style={{ borderColor: "var(--app-border-soft)" }}
                    >
                      <td className="px-5 py-3 font-black">
                        {studentNameById.get(result.studentId) || "学生"}
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {result.courseName}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-black">{result.title}</p>
                        <p className="app-muted-text mt-1 text-[9px]">
                          {result.typeLabel} · {result.detail}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-sm font-black">
                          {result.score} / {result.totalPoints}
                        </p>
                        <p className="app-muted-text mt-1 text-[9px]">
                          {percent.toFixed(1)}%
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black"
                          style={{
                            color: result.passed
                              ? "var(--app-success)"
                              : "var(--app-warm)",
                            backgroundColor: result.passed
                              ? "var(--app-success-soft)"
                              : "var(--app-warm-soft)",
                          }}
                        >
                          {result.passed ? (
                            <CheckCircle2 size={10} />
                          ) : (
                            <XCircle size={10} />
                          )}
                          {result.resultLabel}
                        </span>
                        {review && (
                          <p className="mt-1 text-[9px] font-black" style={{ color: "var(--app-warm)" }}>
                            {GRADE_REVIEW_STATUS_LABELS[review.status]}
                          </p>
                        )}
                      </td>
                      <td className="app-muted-text px-3 py-3 text-[10px]">
                        {gradeDateFormatter.format(new Date(result.recordedAt))}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={result.href}
                          className="inline-flex items-center gap-1 font-black"
                          style={{ color: "var(--app-secondary)" }}
                        >
                          {result.sourceType === "assignment_submission"
                            ? "核对批改"
                            : "查看测试"}
                          <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="app-muted-text px-5 py-12 text-center text-xs"
                    >
                      还没有已批改作业、考试或章节测试成绩。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="app-card overflow-hidden rounded-3xl border">
          <div
            className="flex items-center gap-2 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--app-border)" }}
          >
            <SearchCheck size={16} style={{ color: "var(--app-warm)" }} />
            <div>
              <h2 className="text-base font-black">成绩复核申请</h2>
              <p className="app-muted-text mt-1 text-[10px]">
                复核只处理学生对真实成绩的异议；需要改分时进入原批改记录操作。
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[13%] px-5 py-3 font-black">学生</th>
                  <th className="w-[22%] px-3 py-3 font-black">成绩来源</th>
                  <th className="w-[27%] px-3 py-3 font-black">申请原因</th>
                  <th className="w-[12%] px-3 py-3 font-black">申请时间</th>
                  <th className="w-[10%] px-3 py-3 font-black">状态</th>
                  <th className="w-[16%] px-5 py-3 font-black">处理</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => {
                  const linkedResult = review.source_result_id
                    ? resultBySource.get(
                        `${review.source_type}:${review.source_result_id}`,
                      )
                    : undefined;
                  const tone = reviewTone(review.status);
                  return (
                    <tr
                      key={review.id}
                      className="border-b align-top text-[11px] last:border-b-0"
                      style={{ borderColor: "var(--app-border-soft)" }}
                    >
                      <td className="px-5 py-3 font-black">
                        {studentNameById.get(review.student_id) || "学生"}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-black">
                          {review.source_title || linkedResult?.title || "历史成绩"}
                        </p>
                        <p className="app-muted-text mt-1 text-[9px]">
                          {sourceTypeLabel(review.source_type)}
                          {review.source_score != null &&
                          review.source_total_points != null
                            ? ` · ${review.source_score} / ${review.source_total_points} 分`
                            : ""}
                        </p>
                        {linkedResult && (
                          <Link
                            href={linkedResult.href}
                            className="mt-1 inline-flex items-center gap-1 text-[9px] font-black"
                            style={{ color: "var(--app-secondary)" }}
                          >
                            打开原成绩
                            <ArrowRight size={9} />
                          </Link>
                        )}
                      </td>
                      <td className="whitespace-pre-wrap px-3 py-3 text-[10px] leading-5">
                        {review.reason}
                      </td>
                      <td className="app-muted-text px-3 py-3 text-[10px]">
                        {gradeDateFormatter.format(new Date(review.requested_at))}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex rounded-full px-2 py-1 text-[9px] font-black"
                          style={{
                            color: tone.color,
                            backgroundColor: tone.background,
                          }}
                        >
                          {GRADE_REVIEW_STATUS_LABELS[review.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <GradeReviewManager
                          reviewId={review.id}
                          response={review.response}
                        />
                      </td>
                    </tr>
                  );
                })}
                {reviews.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="app-muted-text px-5 py-12 text-center text-xs"
                    >
                      当前没有成绩复核申请。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <details className="app-card group overflow-hidden rounded-3xl border">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5"
          >
            <div>
              <h2 className="text-base font-black">成绩来源检查</h2>
              <p className="app-muted-text mt-1 text-[10px]">
                辅助核对本机构有哪些作业、考试和章节测试正在参与成绩汇总。
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black"
              style={{
                color: "var(--app-secondary)",
                backgroundColor: "var(--app-secondary-soft)",
              }}
            >
              查看明细
              <ChevronDown
                className="ml-1 inline transition-transform group-open:rotate-180"
                size={12}
              />
            </span>
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[18%] px-5 py-3 font-black">类型</th>
                  <th className="w-[24%] px-3 py-3 font-black">课程</th>
                  <th className="w-[36%] px-3 py-3 font-black">考核名称</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">成绩数</th>
                  <th className="w-[12%] px-5 py-3 font-black">状态</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr
                    key={`source-assignment-${assignment.id}`}
                    className="border-b text-[11px] last:border-b-0"
                    style={{ borderColor: "var(--app-border-soft)" }}
                  >
                    <td className="px-5 py-3 font-black">
                      {ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}
                    </td>
                    <td className="px-3 py-3">
                      {assignment.course_id
                        ? courseNameById.get(assignment.course_id) ?? "关联课程"
                        : "综合任务"}
                    </td>
                    <td className="px-3 py-3 font-bold">{assignment.title}</td>
                    <td className="px-3 py-3 text-center font-mono font-black">
                      {resultCountBySource.get(
                        `assignment_submission:${assignment.id}`,
                      ) ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-[9px] font-black"
                        style={{
                          color: "var(--app-success)",
                          backgroundColor: "var(--app-success-soft)",
                        }}
                      >
                        实时读取
                      </span>
                    </td>
                  </tr>
                ))}
                {tests.map((test) => (
                  <tr
                    key={`source-test-${test.id}`}
                    className="border-b text-[11px] last:border-b-0"
                    style={{ borderColor: "var(--app-border-soft)" }}
                  >
                    <td className="px-5 py-3 font-black">章节测试</td>
                    <td className="px-3 py-3">
                      {COURSE_KEY_LABELS[test.course_key] ?? test.course_key}
                    </td>
                    <td className="px-3 py-3 font-bold">
                      第 {test.chapter_number} 章 · {test.title}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-black">
                      {resultCountBySource.get(
                        `chapter_test_attempt:${test.id}`,
                      ) ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-[9px] font-black"
                        style={{
                          color: "var(--app-success)",
                          backgroundColor: "var(--app-success-soft)",
                        }}
                      >
                        实时读取
                      </span>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && tests.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="app-muted-text px-5 py-10 text-center text-xs"
                    >
                      当前没有可汇总的成绩来源。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}
