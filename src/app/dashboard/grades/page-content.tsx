import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";

import {
  ASSIGNMENT_TYPE_LABELS,
  type AssignmentType,
} from "@/app/dashboard/assignments/config";
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
import { gradeLevel, type GradeReviewStatus } from "./config";

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
    reviewsResult,
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
          .from("grade_review_requests")
          .select(
            "id,source_type,source_result_id,source_title,status,reason,response,updated_at",
          )
          .eq("student_id", user.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as ReviewRow[], error: null }),
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
  const reviews = (reviewsResult.data ?? []) as ReviewRow[];
  const courses = (coursesResult.data ?? []) as CourseRow[];
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
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

  results.sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  // 章节测试只在对应章节结果页读取；成绩中心不再为不可见数据发起额外查询。
  const displayedResults = results;

  const dataError =
    assignmentsResult.error ||
    submissionsResult.error ||
    reviewsResult.error ||
    coursesResult.error ||
    submissionAnswersResult.error ||
    assignmentQuestionsResult.error ||
    paperQuestionsResult.error;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {canManage && (
          <section className="app-card flex flex-col gap-4 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                  color: "var(--support)",
                  backgroundColor: "var(--support-surface)",
                }}
              >
                <Eye size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--support)]">
                  预览模式
                </p>
                <h2 className="mt-1 text-base font-bold">
                  当前仅预览学生端成绩中心布局
                </h2>
                <p className="app-muted-text mt-1 text-sm font-medium leading-6">
                  此处不会混入管理者个人成绩或机构汇总。查看真实学生成绩、批改和复核，请进入成绩后台。
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/admin/grades"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--support)] focus-visible:ring-offset-2"
              style={{ backgroundColor: "var(--support)" }}
            >
              进入成绩后台
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
        )}

        {dataError && (
          <section
            className="rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
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
          memoryKey={`student-grade-category-v1:${user.id}:${STUDENT_APP_IDS.korean}`}
        />
      </div>
    </div>
  );
}
