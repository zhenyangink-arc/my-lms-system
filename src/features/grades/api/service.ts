import "server-only";

import { requireGradeCenterOverviewAccess } from "@/lib/grade-center";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AssignmentGradeSource,
  ChapterTestGradeAttempt,
  ChapterTestGradeSource,
  GradeManagementData,
  GradeReviewRequest,
  GradeReviewSourceType,
  GradeSourceSummary,
  LearningSubmissionGrade,
  LiveGradeResult,
  PlatformGradeOverviewRow,
} from "./types";

type GradeReviewDatabaseRow = Omit<
  GradeReviewRequest,
  "student_name" | "linked_result_key"
>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CourseRow = {
  id: string;
  title: string;
};

const ASSIGNMENT_TYPE_LABELS: Record<
  AssignmentGradeSource["assignment_type"],
  string
> = {
  homework: "作业",
  quiz: "测验",
  exam: "考试",
};

const COURSE_KEY_LABELS: Record<string, string> = {
  "hangul-introduction": "韩语字母入门",
  "korean-level-one": "韩国语1级",
  "korean-level-two": "韩国语2级",
};

function gradeLevel(percent: number) {
  if (percent >= 90) return "优秀";
  if (percent >= 80) return "良好";
  if (percent >= 70) return "中等";
  if (percent >= 60) return "及格";
  return "需加强";
}

function resultLookupKey(
  sourceType: GradeReviewSourceType,
  sourceResultId: string | null,
) {
  return sourceResultId ? `${sourceType}:${sourceResultId}` : null;
}

export async function getGradeManagementData(): Promise<GradeManagementData> {
  const access = await requireGradeCenterOverviewAccess();

  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc(
      "get_platform_grade_overview",
    );

    return {
      scope: "platform",
      role: access.role,
      canManageIndividualGrades: false,
      overview: (data ?? []) as PlatformGradeOverviewRow[],
      hasError: Boolean(error),
    };
  }

  const { supabase, role, tenantId, user } = access;
  const institutionTenantId = tenantId!;
  const admin = createAdminClient();
  const assignedStudentIds =
    role === "teacher"
      ? await getTeacherAssignedStudentIds(
          supabase,
          institutionTenantId,
          user.id,
        )
      : null;

  let submissionsQuery = supabase
    .from("learning_submissions")
    .select(
      "id,assignment_id,student_id,score,overall_feedback,graded_at,submitted_at,attempt_number",
    )
    .eq("tenant_id", institutionTenantId)
    .eq("status", "graded")
    .not("score", "is", null)
    .order("attempt_number", { ascending: false });
  let attemptsQuery = supabase
    .from("chapter_test_attempts")
    .select(
      "id,student_id,test_slug,score,correct_count,total_questions,passed,attempted_at",
    )
    .eq("tenant_id", institutionTenantId)
    .order("attempted_at", { ascending: false });
  let reviewsQuery = supabase
    .from("grade_review_requests")
    .select(
      "id,record_id,student_id,source_type,source_result_id,source_title,source_score,source_total_points,source_context,reason,status,response,requested_at",
    )
    .eq("tenant_id", institutionTenantId)
    .order("requested_at", { ascending: false });

  if (assignedStudentIds) {
    submissionsQuery = submissionsQuery.in("student_id", assignedStudentIds);
    attemptsQuery = attemptsQuery.in("student_id", assignedStudentIds);
    reviewsQuery = reviewsQuery.in("student_id", assignedStudentIds);
  }

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
      .eq("tenant_id", institutionTenantId)
      .in("status", ["published", "closed"])
      .order("created_at", { ascending: false }),
    submissionsQuery,
    attemptsQuery,
    reviewsQuery,
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
      .eq("tenant_id", institutionTenantId)
      .order("title", { ascending: true }),
  ]);

  const assignments = (assignmentsResult.data ?? []) as AssignmentGradeSource[];
  const submissions = (submissionsResult.data ?? []) as LearningSubmissionGrade[];
  const attempts = (attemptsResult.data ?? []) as ChapterTestGradeAttempt[];
  const reviewRows = (reviewsResult.data ?? []) as GradeReviewDatabaseRow[];
  const tests = (testsResult.data ?? []) as ChapterTestGradeSource[];
  const courses = (coursesResult.data ?? []) as CourseRow[];
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
  const testBySlug = new Map(tests.map((test) => [test.slug, test]));
  const courseNameById = new Map(
    courses.map((course) => [course.id, course.title]),
  );

  // The query is ordered by attempt_number descending. Keep only the first
  // graded submission for each assignment/student pair, matching the old page.
  const latestSubmissions = new Map<string, LearningSubmissionGrade>();
  for (const submission of submissions) {
    const key = `${submission.assignment_id}:${submission.student_id}`;
    if (!latestSubmissions.has(key)) latestSubmissions.set(key, submission);
  }

  const resultRows: Omit<LiveGradeResult, "student_name" | "review_status">[] = [];
  for (const submission of latestSubmissions.values()) {
    const assignment = assignmentById.get(submission.assignment_id);
    if (!assignment) continue;
    const percent = assignment.total_points
      ? (Number(submission.score) / Number(assignment.total_points)) * 100
      : 0;
    resultRows.push({
      key: `assignment:${submission.id}`,
      source_type: "assignment_submission",
      source_result_id: submission.id,
      source_id: assignment.id,
      student_id: submission.student_id,
      course_name: assignment.course_id
        ? courseNameById.get(assignment.course_id) ?? "关联课程"
        : "综合任务",
      title: assignment.title,
      type_label: ASSIGNMENT_TYPE_LABELS[assignment.assignment_type],
      score: Number(submission.score),
      total_points: Number(assignment.total_points),
      detail: `第 ${submission.attempt_number} 次提交`,
      result_label: gradeLevel(percent),
      passed: percent >= 60,
      recorded_at: submission.graded_at ?? submission.submitted_at,
      detail_path: `/dashboard/admin/assignments/${assignment.id}`,
    });
  }

  for (const attempt of attempts) {
    const test = testBySlug.get(attempt.test_slug);
    if (!test) continue;
    resultRows.push({
      key: `chapter:${attempt.id}`,
      source_type: "chapter_test_attempt",
      source_result_id: attempt.id,
      source_id: test.id,
      student_id: attempt.student_id,
      course_name: COURSE_KEY_LABELS[test.course_key] ?? test.course_key,
      title: `第 ${test.chapter_number} 章 · ${test.title}`,
      type_label: "章节测试",
      score: Number(attempt.score),
      total_points: 100,
      detail: `${attempt.correct_count} / ${attempt.total_questions} 题`,
      result_label: attempt.passed ? "已通过" : "未通过",
      passed: attempt.passed,
      recorded_at: attempt.attempted_at,
      detail_path: `/dashboard/assignments/korean/${test.slug}`,
    });
  }

  resultRows.sort(
    (left, right) =>
      new Date(right.recorded_at).getTime() -
      new Date(left.recorded_at).getTime(),
  );

  const studentIds = [
    ...new Set([
      ...resultRows.map((result) => result.student_id),
      ...reviewRows.map((review) => review.student_id),
    ]),
  ];
  const { data: profileData, error: profileError } = studentIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", studentIds)
    : { data: [] as ProfileRow[], error: null };
  const studentNameById = new Map(
    ((profileData ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.full_name?.trim() || profile.email || "学生",
    ]),
  );
  const reviewBySource = new Map(
    reviewRows
      .map((review) => [
        resultLookupKey(review.source_type, review.source_result_id),
        review,
      ] as const)
      .filter(
        (entry): entry is readonly [string, GradeReviewDatabaseRow] =>
          entry[0] !== null,
      ),
  );
  const resultKeyBySource = new Map(
    resultRows.map((result) => [
      `${result.source_type}:${result.source_result_id}`,
      result.key,
    ]),
  );
  const results: LiveGradeResult[] = resultRows.map((result) => ({
    ...result,
    student_name: studentNameById.get(result.student_id) || "学生",
    review_status:
      reviewBySource.get(`${result.source_type}:${result.source_result_id}`)
        ?.status ?? null,
  }));
  const reviews: GradeReviewRequest[] = reviewRows.map((review) => {
    const sourceKey = resultLookupKey(
      review.source_type,
      review.source_result_id,
    );
    return {
      ...review,
      student_name: studentNameById.get(review.student_id) || "学生",
      linked_result_key: sourceKey
        ? resultKeyBySource.get(sourceKey) ?? null
        : null,
    };
  });

  const resultCountBySource = new Map<string, number>();
  for (const result of results) {
    const key = `${result.source_type}:${result.source_id}`;
    resultCountBySource.set(key, (resultCountBySource.get(key) ?? 0) + 1);
  }
  const sources: GradeSourceSummary[] = [
    ...assignments.map((assignment) => ({
      source_type: "assignment_submission" as const,
      source_id: assignment.id,
      course_name: assignment.course_id
        ? courseNameById.get(assignment.course_id) ?? "关联课程"
        : "综合任务",
      title: assignment.title,
      type_label: ASSIGNMENT_TYPE_LABELS[assignment.assignment_type],
      status: assignment.status,
      result_count:
        resultCountBySource.get(
          `assignment_submission:${assignment.id}`,
        ) ?? 0,
    })),
    ...tests.map((test) => ({
      source_type: "chapter_test_attempt" as const,
      source_id: test.id,
      course_name: COURSE_KEY_LABELS[test.course_key] ?? test.course_key,
      title: `第 ${test.chapter_number} 章 · ${test.title}`,
      type_label: "章节测试",
      status: "published" as const,
      result_count:
        resultCountBySource.get(`chapter_test_attempt:${test.id}`) ?? 0,
    })),
  ];
  const pendingReviewCount = reviews.filter(
    (review) => review.status === "pending" || review.status === "reviewing",
  ).length;
  const hasError = Boolean(
    assignmentsResult.error ||
      submissionsResult.error ||
      attemptsResult.error ||
      reviewsResult.error ||
      testsResult.error ||
      coursesResult.error ||
      profileError,
  );

  return {
    scope: "institution",
    role,
    tenantId: institutionTenantId,
    canManageIndividualGrades: true,
    assignedStudentIds,
    results,
    reviews,
    sources,
    pendingReviewCount,
    hasError,
  };
}
