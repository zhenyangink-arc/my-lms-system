import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  SearchCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import {
  ASSIGNMENT_TYPE_LABELS,
  type AssignmentType,
} from "@/app/dashboard/assignments/config";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { createAdminClient } from "@/lib/supabase/admin";
import { GradeReviewForm } from "./GradeReviewForm";
import {
  GRADE_REVIEW_STATUS_LABELS,
  gradeDateFormatter,
  gradeLevel,
  type GradeReviewStatus,
} from "./config";

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  assignment_type: AssignmentType;
  total_points: number;
  course_id: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
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
  test_slug: string;
  score: number;
  correct_count: number;
  total_questions: number;
  passed: boolean;
  attempted_at: string;
};

type ReviewRow = {
  id: string;
  source_type:
    | "manual_grade_record"
    | "assignment_submission"
    | "chapter_test_attempt";
  source_result_id: string | null;
  source_title: string;
  status: GradeReviewStatus;
  reason: string;
  response: string;
  updated_at: string;
};

type CourseRow = { id: string; title: string };

type StudentResult = {
  key: string;
  sourceType: "assignment_submission" | "chapter_test_attempt";
  sourceResultId: string;
  courseName: string;
  title: string;
  subtitle: string;
  typeLabel: string;
  score: number;
  totalPoints: number;
  passed: boolean;
  resultLabel: string;
  feedback: string;
  recordedAt: string;
  href: string;
};

const COURSE_KEY_LABELS: Record<string, string> = {
  "hangul-introduction": "韩语字母入门",
  "korean-level-one": "韩国语1级",
  "korean-level-two": "韩国语2级",
};

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

export default async function GradesPage() {
  const { supabase, user, role, canManage } = await getGradeCenterAccess();
  const admin = createAdminClient();
  const isStudent = role === "student";

  const [
    assignmentsResult,
    submissionsResult,
    attemptsResult,
    reviewsResult,
    testsResult,
    coursesResult,
  ] = await Promise.all([
    isStudent
      ? supabase
          .from("learning_assignments")
          .select(
            "id,title,description,assignment_type,total_points,course_id",
          )
          .in("status", ["published", "closed"])
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    isStudent
      ? supabase
          .from("learning_submissions")
          .select(
            "id,assignment_id,score,overall_feedback,graded_at,submitted_at,attempt_number",
          )
          .eq("student_id", user.id)
          .eq("status", "graded")
          .not("score", "is", null)
          .order("attempt_number", { ascending: false })
      : Promise.resolve({ data: [] as SubmissionRow[], error: null }),
    isStudent
      ? supabase
          .from("chapter_test_attempts")
          .select(
            "id,test_slug,score,correct_count,total_questions,passed,attempted_at",
          )
          .eq("student_id", user.id)
          .order("attempted_at", { ascending: false })
      : Promise.resolve({ data: [] as ChapterAttemptRow[], error: null }),
    isStudent
      ? supabase
          .from("grade_review_requests")
          .select(
            "id,source_type,source_result_id,source_title,status,reason,response,updated_at",
          )
          .eq("student_id", user.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as ReviewRow[], error: null }),
    admin
      .from("chapter_tests")
      .select(
        "id,slug,course_key,chapter_number,title,korean_title,passing_score",
      )
      .eq("status", "published"),
    isStudent
      ? supabase.from("courses").select("id,title")
      : Promise.resolve({ data: [] as CourseRow[], error: null }),
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

  const latestSubmissionByAssignment = new Map<string, SubmissionRow>();
  for (const submission of submissions) {
    if (!latestSubmissionByAssignment.has(submission.assignment_id)) {
      latestSubmissionByAssignment.set(submission.assignment_id, submission);
    }
  }

  const results: StudentResult[] = [];
  for (const submission of latestSubmissionByAssignment.values()) {
    const assignment = assignmentById.get(submission.assignment_id);
    if (!assignment) continue;
    const totalPoints = Number(assignment.total_points);
    const score = Number(submission.score);
    const percent = totalPoints ? (score / totalPoints) * 100 : 0;
    results.push({
      key: `assignment:${submission.id}`,
      sourceType: "assignment_submission",
      sourceResultId: submission.id,
      courseName: assignment.course_id
        ? courseNameById.get(assignment.course_id) ?? "关联课程"
        : "综合任务",
      title: assignment.title,
      subtitle: `第 ${submission.attempt_number} 次提交`,
      typeLabel: ASSIGNMENT_TYPE_LABELS[assignment.assignment_type],
      score,
      totalPoints,
      passed: percent >= 60,
      resultLabel: gradeLevel(percent),
      feedback: submission.overall_feedback ?? "",
      recordedAt: submission.graded_at ?? submission.submitted_at,
      href: `/dashboard/assignments/${assignment.id}`,
    });
  }

  for (const attempt of attempts) {
    const test = testBySlug.get(attempt.test_slug);
    if (!test) continue;
    results.push({
      key: `chapter:${attempt.id}`,
      sourceType: "chapter_test_attempt",
      sourceResultId: attempt.id,
      courseName: COURSE_KEY_LABELS[test.course_key] ?? test.course_key,
      title: `第 ${test.chapter_number} 章 · ${test.title}`,
      subtitle: `${attempt.correct_count} / ${attempt.total_questions} 题`,
      typeLabel: "章节测试",
      score: Number(attempt.score),
      totalPoints: 100,
      passed: attempt.passed,
      resultLabel: attempt.passed ? "已通过" : "未通过",
      feedback: attempt.passed
        ? "已达到本章掌握线。"
        : `本章掌握线为 ${test.passing_score} 分，建议复习后再试。`,
      recordedAt: attempt.attempted_at,
      href: `/dashboard/assignments/korean/${test.slug}`,
    });
  }

  results.sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const reviewBySource = new Map(
    reviews
      .filter((review) => review.source_result_id)
      .map((review) => [
        `${review.source_type}:${review.source_result_id}`,
        review,
      ]),
  );
  const percentages = results.map((result) =>
    result.totalPoints ? (result.score / result.totalPoints) * 100 : 0,
  );
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : null;
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
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {canManage && (
          <div className="flex justify-end">
            <Link
              href="/dashboard/admin/grades"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              进入成绩后台
              <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {canManage && <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{ backgroundColor: "var(--app-card-bg)" }}
        >
          <div className={canManage ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-center" : "grid"}>
            {canManage && <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <Eye size={14} />
                学生成绩页预览
              </span>
              <DashboardTitleWithHint
                className="mt-3"
                title={
                  average == null
                    ? "完成学习任务后，这里会自动形成成绩单"
                    : `${gradeLevel(average)} · 继续稳步向前`
                }
                description="已批改的作业、考试和章节测试成绩会直接汇总到这里，不需要等待二次发布。"
              />
            </div>}
            <div className={canManage ? "dashboard-title-metrics" : "grid grid-cols-3 gap-2"}>
              {[
                [
                  "平均得分率",
                  average == null ? "—" : `${average.toFixed(1)}%`,
                  TrendingUp,
                  "var(--app-accent)",
                  "var(--app-accent-soft)",
                ],
                [
                  "成绩记录",
                  results.length,
                  ClipboardCheck,
                  "var(--app-secondary)",
                  "var(--app-secondary-soft)",
                ],
                [
                  "复核处理中",
                  pendingReviews,
                  SearchCheck,
                  "var(--app-warm)",
                  "var(--app-warm-soft)",
                ],
              ].map(([label, value, Icon, color, soft]) => {
                const MetricIcon = Icon as typeof Award;
                return (
                  <div
                    key={String(label)}
                    className="app-soft-card rounded-2xl border p-4 text-center"
                  >
                    <span
                      className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{
                        color: String(color),
                        backgroundColor: String(soft),
                      }}
                    >
                      <MetricIcon size={17} />
                    </span>
                    <p className="mt-2 text-xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-xs font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>}

        {dataError && (
          <section
            className="rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            部分成绩暂时无法读取，请稍后刷新页面。
          </section>
        )}

        <section className="app-card overflow-hidden rounded-3xl border">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div>
              <h2 className="text-base font-black">成绩明细</h2>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {average !== null && (
                <span
                  className="rounded-full px-3 py-1.5 text-[11px] font-black"
                  style={{
                    color: "var(--app-success)",
                    backgroundColor: "var(--app-success-soft)",
                  }}
                >
                  平均 {average.toFixed(1)}%
                </span>
              )}
              {pendingReviews > 0 && (
                <span
                  className="rounded-full px-3 py-1.5 text-[11px] font-black"
                  style={{
                    color: "var(--app-warm)",
                    backgroundColor: "var(--app-warm-soft)",
                  }}
                >
                  复核中 {pendingReviews}
                </span>
              )}
              {results.length > 0 && (
                <span className="app-muted-text rounded-full border border-[var(--app-border)] px-3 py-1.5 text-[11px] font-black">
                  {results.length} 条成绩
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[16%] px-5 py-3 font-black">课程</th>
                  <th className="w-[26%] px-3 py-3 font-black">考核内容</th>
                  <th className="w-[13%] px-3 py-3 font-black">得分</th>
                  <th className="w-[12%] px-3 py-3 font-black">结果</th>
                  <th className="w-[15%] px-3 py-3 font-black">记录时间</th>
                  <th className="w-[18%] px-5 py-3 font-black">查看与复核</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const review = reviewBySource.get(
                    `${result.sourceType}:${result.sourceResultId}`,
                  );
                  const tone = review ? reviewTone(review.status) : null;
                  const percent = result.totalPoints
                    ? (result.score / result.totalPoints) * 100
                    : 0;
                  const canRequestAgain =
                    !review ||
                    review.status === "resolved" ||
                    review.status === "rejected";
                  return (
                    <tr
                      key={result.key}
                      className="border-b align-top text-[11px] last:border-b-0"
                      style={{ borderColor: "var(--app-border-soft)" }}
                    >
                      <td className="px-5 py-4 font-black">
                        {result.courseName}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-black">{result.title}</p>
                        <p className="app-muted-text mt-1 text-[9px]">
                          {result.typeLabel} · {result.subtitle}
                        </p>
                        {result.feedback && (
                          <p className="app-muted-text mt-2 line-clamp-2 text-[10px] leading-5">
                            {result.feedback}
                          </p>
                        )}
                        {review?.response && (
                          <p
                            className="mt-2 rounded-lg px-2.5 py-2 text-[10px] leading-5"
                            style={{
                              color: "var(--app-success)",
                              backgroundColor: "var(--app-success-soft)",
                            }}
                          >
                            复核回复：{review.response}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-mono text-sm font-black">
                          {result.score} / {result.totalPoints}
                        </p>
                        <p className="app-muted-text mt-1 text-[9px]">
                          {percent.toFixed(1)}%
                        </p>
                      </td>
                      <td className="px-3 py-4">
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
                        {review && tone && (
                          <span
                            className="mt-2 block w-fit rounded-full px-2 py-1 text-[9px] font-black"
                            style={{
                              color: tone.color,
                              backgroundColor: tone.background,
                            }}
                          >
                            复核：{GRADE_REVIEW_STATUS_LABELS[review.status]}
                          </span>
                        )}
                      </td>
                      <td className="app-muted-text px-3 py-4 text-[10px]">
                        {gradeDateFormatter.format(new Date(result.recordedAt))}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={result.href}
                          className="inline-flex items-center gap-1 text-[10px] font-black"
                          style={{ color: "var(--app-secondary)" }}
                        >
                          查看原记录
                          <ArrowRight size={10} />
                        </Link>
                        {isStudent && canRequestAgain && (
                          <div className="mt-3 min-w-[210px]">
                            <GradeReviewForm
                              sourceType={result.sourceType}
                              sourceResultId={result.sourceResultId}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center"
                    >
                      <BookOpenCheck
                        className="mx-auto opacity-30"
                        size={34}
                      />
                      <p className="mt-3 font-black">
                        当前还没有可显示的成绩
                      </p>
                      <p className="app-muted-text mt-2 text-xs">
                        作业或考试完成批改、章节测试完成交卷后，会自动出现在这里。
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
