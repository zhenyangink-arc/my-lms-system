import Link from "next/link";
import { redirect } from "next/navigation";
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
import { LocalDateTime } from "@/components/LocalDateTime";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { canUseStudentFeature } from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStudentAppCourseScope,
  withStudentAppSchemaFallback,
} from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import {
  GradeBoard,
  type GradeCategory,
  type GradeSkillProfileItem,
  type LanguageSkill,
} from "./GradeBoard";
import { GradeReviewForm } from "./GradeReviewForm";
import {
  GRADE_DATE_TIME_OPTIONS,
  GRADE_REVIEW_STATUS_LABELS,
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
  source_paper_id: string | null;
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
type AssignmentQuestionRow = {
  id: string;
  assignment_id: string;
  points: number;
  sort_order: number;
  question_type: string;
};
type SubmissionAnswerRow = {
  submission_id: string;
  question_id: string;
  awarded_points: number | null;
};
type PaperQuestionRow = {
  paper_id: string;
  sort_order: number;
  skill: string;
  question_type: string;
};
type GradeSkillProfileRow = {
  grade_category: GradeCategory;
  skill: string;
  percentage: number | string | null;
  earned_points: number | string;
  total_points: number | string;
  question_count: number | string;
  assessment_count: number | string;
};

type StudentResult = {
  key: string;
  category: "chapter_test" | "homework" | "exam";
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
  skills: LanguageSkill[];
};

const COURSE_KEY_LABELS: Record<string, string> = {
  "hangul-introduction": "韩语字母入门",
  "korean-level-one": "韩国语1级",
  "korean-level-two": "韩国语2级",
};

function normalizeLanguageSkill(
  rawSkill: string,
  questionType: string,
): LanguageSkill | null {
  const skill = rawSkill.trim().toLowerCase();
  if (/listening|listen|听力|听写|듣기/.test(skill)) return "listening";
  if (/speaking|speak|口语|发音|朗读|录音|말하기/.test(skill)) {
    return "speaking";
  }
  if (/reading|read|阅读|理解|읽기/.test(skill)) return "reading";
  if (/writing|write|写作|作文|书写|쓰기/.test(skill)) return "writing";
  if (/vocabulary|vocab|word|词汇|单词|字词|어휘/.test(skill)) {
    return "vocabulary";
  }
  if (/grammar|language use|语法|句法|语言运用|문법/.test(skill)) {
    return "grammar";
  }
  if (questionType === "long_text") return "writing";
  if (questionType === "file_link") return "speaking";
  return null;
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

export function GradeResultSection({
  title,
  description,
  icon: Icon,
  color,
  soft,
  results,
  reviewBySource,
  isStudent,
  dataError,
}: {
  title: string;
  description: string;
  icon: typeof BookOpenCheck;
  color: string;
  soft: string;
  results: StudentResult[];
  reviewBySource: Map<string, ReviewRow>;
  isStudent: boolean;
  dataError: unknown;
}) {
  const percentages = results.map((result) =>
    result.totalPoints ? (result.score / result.totalPoints) * 100 : 0,
  );
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : null;

  return (
    <section className="app-card overflow-hidden rounded-3xl border">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ color, backgroundColor: soft }}
          >
            <Icon size={18} />
          </span>
          <div>
            <h2 className="text-base font-black">{title}</h2>
            <p className="app-muted-text mt-0.5 text-[10px] font-bold">
              {description}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {average !== null && (
            <span
              className="rounded-full px-3 py-1.5 text-[11px] font-black"
              style={{ color, backgroundColor: soft }}
            >
              平均 {average.toFixed(1)}%
            </span>
          )}
          <span className="app-muted-text rounded-full border border-[var(--app-border)] px-3 py-1.5 text-[11px] font-black">
            {results.length} 条成绩
          </span>
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
                    <LocalDateTime
                      value={result.recordedAt}
                      options={GRADE_DATE_TIME_OPTIONS}
                    />
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
            {results.length === 0 && !dataError && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <Icon className="mx-auto opacity-30" size={30} />
                  <p className="mt-3 font-black">当前还没有{title}成绩</p>
                  <p className="app-muted-text mt-2 text-xs">
                    完成并产生成绩后，会自动显示在这个板块。
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function GradesPage() {
  const { supabase, user, role, canManage, membershipTier, tenantId } =
    await getGradeCenterAccess();
  const isStudent = role === "student";

  // 服务端必须自己校验会员档位：之前只靠前端隐藏入口，chapter_test_attempts 等表的
  // RLS 又没有统一按 student_feature_allowed 收紧，普通档位学生直连这个路由仍能看到
  // 部分成绩数据（各表 RLS 尺度不一致，出现"服务端放行、RLS 拒绝"的不一致体验）。
  if (isStudent && !canUseStudentFeature(role, membershipTier, "learning_assignments")) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const koreanScope = await getStudentAppCourseScope(supabase, "korean");

  const [
    assignmentsResult,
    submissionsResult,
    attemptsResult,
    reviewsResult,
    testsResult,
    coursesResult,
  ] = await Promise.all([
    isStudent
      ? withStudentAppSchemaFallback(
          supabase
            .from("learning_assignments")
            .select(
              "id,title,description,assignment_type,total_points,course_id,source_paper_id",
            )
            .eq("student_app_id", STUDENT_APP_IDS.korean)
            .in("status", ["published", "closed"]),
          () =>
            supabase
              .from("learning_assignments")
              .select(
                "id,title,description,assignment_type,total_points,course_id,source_paper_id",
              )
              .in("status", ["published", "closed"]),
        )
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
    withStudentAppSchemaFallback(
      admin
        .from("chapter_tests")
        .select(
          "id,slug,course_key,chapter_number,title,korean_title,passing_score",
        )
        .eq("student_app_id", STUDENT_APP_IDS.korean)
        .eq("status", "published"),
      () =>
        admin
          .from("chapter_tests")
          .select(
            "id,slug,course_key,chapter_number,title,korean_title,passing_score",
          )
          .eq("status", "published"),
    ),
    isStudent
      ? supabase
          .from("courses")
          .select("id,title")
          .in("id", koreanScope.courseIds)
      : Promise.resolve({ data: [] as CourseRow[], error: null }),
  ]);

  const koreanCourseIds = new Set(koreanScope.courseIds);
  const assignments = ((assignmentsResult.data ?? []) as AssignmentRow[]).filter(
    (assignment) => !assignment.course_id || koreanCourseIds.has(assignment.course_id),
  );
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

  const latestSubmissions = [...latestSubmissionByAssignment.values()];
  const latestSubmissionIds = latestSubmissions.map((submission) => submission.id);
  const gradedAssignmentIds = latestSubmissions.map(
    (submission) => submission.assignment_id,
  );
  const sourcePaperIds = [
    ...new Set(
      assignments
        .map((assignment) => assignment.source_paper_id)
        .filter((paperId): paperId is string => Boolean(paperId)),
    ),
  ];
  const [
    submissionAnswersResult,
    assignmentQuestionsResult,
    paperQuestionsResult,
    databaseSkillProfilesResult,
  ] =
    await Promise.all([
      latestSubmissionIds.length
        ? supabase
            .from("learning_submission_answers")
            .select("submission_id,question_id,awarded_points")
            .in("submission_id", latestSubmissionIds)
        : Promise.resolve({ data: [] as SubmissionAnswerRow[], error: null }),
      gradedAssignmentIds.length
        ? admin
            .from("learning_assignment_questions")
            .select("id,assignment_id,points,sort_order,question_type")
            .in("assignment_id", gradedAssignmentIds)
        : Promise.resolve({ data: [] as AssignmentQuestionRow[], error: null }),
      sourcePaperIds.length
        ? admin
            .from("assessment_paper_questions")
            .select("paper_id,sort_order,skill,question_type")
            .in("paper_id", sourcePaperIds)
        : Promise.resolve({ data: [] as PaperQuestionRow[], error: null }),
      isStudent
        ? withStudentAppSchemaFallback(
            admin
              .from("student_grade_skill_profiles")
              .select(
                "grade_category,skill,percentage,earned_points,total_points,question_count,assessment_count",
              )
              .eq("tenant_id", tenantId!)
              .eq("student_id", user.id)
              .eq("student_app_id", STUDENT_APP_IDS.korean),
            () =>
              admin
                .from("student_grade_skill_profiles")
                .select(
                  "grade_category,skill,percentage,earned_points,total_points,question_count,assessment_count",
                )
                .eq("tenant_id", tenantId!)
                .eq("student_id", user.id),
          )
        : Promise.resolve({ data: [] as GradeSkillProfileRow[], error: null }),
    ]);

  const submissionAnswers = (submissionAnswersResult.data ?? []) as SubmissionAnswerRow[];
  const assignmentQuestions = (assignmentQuestionsResult.data ?? []) as AssignmentQuestionRow[];
  const paperQuestions = (paperQuestionsResult.data ?? []) as PaperQuestionRow[];
  const assignmentQuestionById = new Map(
    assignmentQuestions.map((question) => [question.id, question]),
  );
  const paperQuestionByOrder = new Map(
    paperQuestions.map((question) => [
      `${question.paper_id}:${question.sort_order}`,
      question,
    ]),
  );
  const submissionById = new Map(
    latestSubmissions.map((submission) => [submission.id, submission]),
  );
  const skillsBySubmission = new Map<string, Set<LanguageSkill>>();
  type SkillTotals = {
    earnedPoints: number;
    totalPoints: number;
    questionCount: number;
    submissionIds: Set<string>;
  };
  const skillTotalsByCategory = new Map<
    GradeCategory,
    Map<LanguageSkill, SkillTotals>
  >([
    ["homework", new Map<LanguageSkill, SkillTotals>()],
    ["exam", new Map<LanguageSkill, SkillTotals>()],
  ]);
  const databaseSkillProfileRows = (databaseSkillProfilesResult.data ?? []) as
    GradeSkillProfileRow[];

  for (const answer of submissionAnswers) {
    if (answer.awarded_points == null) continue;
    const question = assignmentQuestionById.get(answer.question_id);
    const submission = submissionById.get(answer.submission_id);
    const assignment = submission
      ? assignmentById.get(submission.assignment_id)
      : undefined;
    if (!question || !assignment?.source_paper_id) continue;
    const paperQuestion = paperQuestionByOrder.get(
      `${assignment.source_paper_id}:${question.sort_order}`,
    );
    if (!paperQuestion) continue;
    const skill = normalizeLanguageSkill(
      paperQuestion.skill,
      paperQuestion.question_type || question.question_type,
    );
    if (!skill) continue;
    const category: GradeCategory =
      assignment.assignment_type === "exam" ? "exam" : "homework";
    const categoryTotals = skillTotalsByCategory.get(category)!;
    const current = categoryTotals.get(skill) ?? {
      earnedPoints: 0,
      totalPoints: 0,
      questionCount: 0,
      submissionIds: new Set<string>(),
    };
    current.earnedPoints += Math.max(0, Number(answer.awarded_points) || 0);
    current.totalPoints += Math.max(0, Number(question.points) || 0);
    current.questionCount += 1;
    current.submissionIds.add(answer.submission_id);
    categoryTotals.set(skill, current);
    const submissionSkills =
      skillsBySubmission.get(answer.submission_id) ?? new Set<LanguageSkill>();
    submissionSkills.add(skill);
    skillsBySubmission.set(answer.submission_id, submissionSkills);
  }

  const skillOrder: LanguageSkill[] = [
    "listening",
    "speaking",
    "reading",
    "writing",
    "grammar",
    "vocabulary",
  ];
  const isLanguageSkill = (skill: string): skill is LanguageSkill =>
    skillOrder.includes(skill as LanguageSkill);
  const databaseProfileByCategory = new Map<
    GradeCategory,
    Map<LanguageSkill, GradeSkillProfileRow>
  >([
    ["homework", new Map<LanguageSkill, GradeSkillProfileRow>()],
    ["exam", new Map<LanguageSkill, GradeSkillProfileRow>()],
  ]);
  for (const row of databaseSkillProfileRows) {
    if (
      (row.grade_category !== "homework" && row.grade_category !== "exam") ||
      !isLanguageSkill(row.skill)
    ) {
      continue;
    }
    databaseProfileByCategory.get(row.grade_category)!.set(row.skill, row);
  }

  const buildSkillProfile = (
    category: GradeCategory,
  ): GradeSkillProfileItem[] =>
    skillOrder.map((skill) => {
      const databaseRow = databaseProfileByCategory.get(category)?.get(skill);
      if (!databaseSkillProfilesResult.error && databaseRow) {
        return {
          skill,
          percentage:
            databaseRow.percentage == null
              ? null
              : Number(databaseRow.percentage),
          earnedPoints: Number(databaseRow.earned_points) || 0,
          totalPoints: Number(databaseRow.total_points) || 0,
          questionCount: Number(databaseRow.question_count) || 0,
          assessmentCount: Number(databaseRow.assessment_count) || 0,
        };
      }

      const totals = skillTotalsByCategory.get(category)?.get(skill);
      return {
        skill,
        percentage:
          totals && totals.totalPoints > 0
            ? Math.round((totals.earnedPoints / totals.totalPoints) * 1000) / 10
            : null,
        earnedPoints: totals?.earnedPoints ?? 0,
        totalPoints: totals?.totalPoints ?? 0,
        questionCount: totals?.questionCount ?? 0,
        assessmentCount: totals?.submissionIds.size ?? 0,
      };
    });

  const skillProfiles: Record<GradeCategory, GradeSkillProfileItem[]> = {
    homework: buildSkillProfile("homework"),
    exam: buildSkillProfile("exam"),
  };

  const results: StudentResult[] = [];
  for (const submission of latestSubmissionByAssignment.values()) {
    const assignment = assignmentById.get(submission.assignment_id);
    if (!assignment || assignment.assignment_type === "quiz") continue;
    const totalPoints = Number(assignment.total_points);
    const score = Number(submission.score);
    const percent = totalPoints ? (score / totalPoints) * 100 : 0;
    results.push({
      key: `assignment:${submission.id}`,
      category:
        assignment.assignment_type === "exam" ? "exam" : "homework",
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
      skills: skillOrder.filter((skill) =>
        skillsBySubmission.get(submission.id)?.has(skill),
      ),
    });
  }

  for (const attempt of attempts) {
    const test = testBySlug.get(attempt.test_slug);
    if (!test) continue;
    results.push({
      key: `chapter:${attempt.id}`,
      category: "chapter_test",
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
      skills: [],
    });
  }

  results.sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  // 章节测试成绩只在对应章节测试结果页展示；成绩中心仅保留老师作业与正式考试。
  const displayedResults = results.filter(
    (result) => result.category !== "chapter_test",
  );

  const percentages = displayedResults.map((result) =>
    result.totalPoints ? (result.score / result.totalPoints) * 100 : 0,
  );
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : null;
  const pendingReviews = reviews.filter(
    (review) =>
      review.source_type === "assignment_submission" &&
      (review.status === "pending" || review.status === "reviewing"),
  ).length;
  const dataError =
    assignmentsResult.error ||
    submissionsResult.error ||
    attemptsResult.error ||
    reviewsResult.error ||
    testsResult.error ||
    coursesResult.error ||
    submissionAnswersResult.error ||
    assignmentQuestionsResult.error ||
    paperQuestionsResult.error;

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
                  displayedResults.length,
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

        <GradeBoard
          results={displayedResults}
          reviews={reviews}
          skillProfiles={skillProfiles}
          isStudent={isStudent}
          dataError={Boolean(dataError)}
        />
      </div>
    </div>
  );
}
