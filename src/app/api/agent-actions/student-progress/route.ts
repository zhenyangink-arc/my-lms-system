import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

const STUDENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECENT_COMPLETION_LIMIT = 5;

type LessonProgressRow = {
  lesson_id: string;
  course_id: string;
  progress_percent: number | null;
  completed_at: string;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
};

type ChapterTestAttemptRow = {
  correct_count: number;
  total_questions: number;
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  assignment_type: "homework" | "quiz" | "exam";
  course_id: string | null;
  starts_at: string;
  due_at: string;
  target_scope: "all_students" | "selected_students";
};

type AssignmentTargetRow = {
  assignment_id: string;
};

type SubmissionRow = {
  assignment_id: string;
  attempt_number: number;
  status: "submitted" | "graded" | "revision_required";
};

type SupabaseError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

function logQueryError(
  studentId: string,
  queryName: string,
  error: SupabaseError,
) {
  console.error("[agent-actions/student-progress] Supabase query failed", {
    studentId,
    queryName,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function isAuthorized(request: Request) {
  const expectedKey = process.env.AGENT_ACTIONS_API_KEY?.trim();
  // 没配置密钥就一律拒绝，不能因为运维还没配置就悄悄放开成"裸奔"状态。
  if (!expectedKey) return false;

  const header = request.headers.get("authorization") ?? "";
  const presentedKey = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (presentedKey.length !== expectedKey.length) return false;

  // 定长比较，避免逐字符提前退出的比较方式给时序攻击留可乘之机。
  let mismatch = 0;
  for (let index = 0; index < expectedKey.length; index += 1) {
    mismatch |= presentedKey.charCodeAt(index) ^ expectedKey.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function GET(request: Request) {
  // 这个接口专供 Dify 智能助手回调查询学生本人的学习进度，不面向浏览器直接访问，
  // 之前完全没有校验调用方身份——任何人只要拿到/猜到学生 UUID 就能查到该学生的
  // 学习进度、正确率、待办任务。Dify 的工具配置必须同步加上
  // `Authorization: Bearer <AGENT_ACTIONS_API_KEY>` 请求头，否则这个接口会全部拒绝。
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = new URL(request.url).searchParams.get("student_id")?.trim();

  if (!studentId) {
    return NextResponse.json(
      { error: "Missing required query parameter: student_id" },
      { status: 400 },
    );
  }

  if (!STUDENT_ID_PATTERN.test(studentId)) {
    return NextResponse.json(
      { error: "student_id must be a valid UUID" },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const membershipsResult = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", studentId)
      .eq("status", "active");

    if (membershipsResult.error) {
      logQueryError(studentId, "tenant_memberships", membershipsResult.error);
      return NextResponse.json(
        { error: "Failed to query student progress" },
        { status: 500 },
      );
    }

    const tenantIds = (membershipsResult.data ?? []).map(
      (membership) => membership.tenant_id as string,
    );

    if (tenantIds.length === 0) {
      return NextResponse.json({
        student_id: studentId,
        recent_completed_chapters: [],
        accuracy: {
          percentage: null,
          correct_count: 0,
          total_questions: 0,
          attempt_count: 0,
        },
        pending_tasks: [],
      });
    }

    const [progressResult, attemptsResult, assignmentsResult, targetsResult, submissionsResult] =
      await Promise.all([
        supabase
          .from("lesson_progress")
          .select("lesson_id,course_id,progress_percent,completed_at")
          .eq("user_id", studentId)
          .eq("status", "completed")
          .in("tenant_id", tenantIds)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(RECENT_COMPLETION_LIMIT),
        supabase
          .from("chapter_test_attempts")
          .select("correct_count,total_questions")
          .eq("student_id", studentId)
          .in("tenant_id", tenantIds),
        supabase
          .from("learning_assignments")
          .select(
            "id,title,description,assignment_type,course_id,starts_at,due_at,target_scope",
          )
          .eq("status", "published")
          .in("tenant_id", tenantIds)
          .order("due_at", { ascending: true }),
        supabase
          .from("learning_assignment_targets")
          .select("assignment_id")
          .eq("student_id", studentId)
          .in("tenant_id", tenantIds),
        supabase
          .from("learning_submissions")
          .select("assignment_id,attempt_number,status")
          .eq("student_id", studentId)
          .in("tenant_id", tenantIds)
          .order("attempt_number", { ascending: false }),
      ]);

    const queryResults = [
      ["lesson_progress", progressResult.error],
      ["chapter_test_attempts", attemptsResult.error],
      ["learning_assignments", assignmentsResult.error],
      ["learning_assignment_targets", targetsResult.error],
      ["learning_submissions", submissionsResult.error],
    ] as const;
    const failedQuery = queryResults.find(([, error]) => error);

    if (failedQuery?.[1]) {
      logQueryError(studentId, failedQuery[0], failedQuery[1]);
      return NextResponse.json(
        { error: "Failed to query student progress" },
        { status: 500 },
      );
    }

    const progressRows = (progressResult.data ?? []) as LessonProgressRow[];
    const lessonIds = progressRows.map((progress) => progress.lesson_id);
    const lessonsResult = lessonIds.length
      ? await supabase
          .from("lessons")
          .select("id,course_id,slug,title")
          .in("id", lessonIds)
      : { data: [] as LessonRow[], error: null };

    if (lessonsResult.error) {
      logQueryError(studentId, "lessons", lessonsResult.error);
      return NextResponse.json(
        { error: "Failed to query student progress" },
        { status: 500 },
      );
    }

    const lessons = (lessonsResult.data ?? []) as LessonRow[];
    const assignmentRows = (assignmentsResult.data ?? []) as AssignmentRow[];
    const courseIds = [
      ...new Set([
        ...lessons.map((lesson) => lesson.course_id),
        ...assignmentRows.flatMap((assignment) =>
          assignment.course_id ? [assignment.course_id] : [],
        ),
      ]),
    ];
    const coursesResult = courseIds.length
      ? await supabase
          .from("courses")
          .select("id,slug,title")
          .in("id", courseIds)
      : { data: [] as CourseRow[], error: null };

    if (coursesResult.error) {
      logQueryError(studentId, "courses", coursesResult.error);
      return NextResponse.json(
        { error: "Failed to query student progress" },
        { status: 500 },
      );
    }

    const lessonById = new Map(
      lessons.map((lesson) => [lesson.id, lesson] as const),
    );
    const courseById = new Map(
      ((coursesResult.data ?? []) as CourseRow[]).map(
        (course) => [course.id, course] as const,
      ),
    );
    const attempts = (attemptsResult.data ?? []) as ChapterTestAttemptRow[];
    const correctCount = attempts.reduce(
      (total, attempt) => total + attempt.correct_count,
      0,
    );
    const totalQuestions = attempts.reduce(
      (total, attempt) => total + attempt.total_questions,
      0,
    );
    const targetedAssignmentIds = new Set(
      ((targetsResult.data ?? []) as AssignmentTargetRow[]).map(
        (target) => target.assignment_id,
      ),
    );
    const latestSubmissionByAssignment = new Map<string, SubmissionRow>();

    for (const submission of (submissionsResult.data ?? []) as SubmissionRow[]) {
      if (!latestSubmissionByAssignment.has(submission.assignment_id)) {
        latestSubmissionByAssignment.set(submission.assignment_id, submission);
      }
    }

    const pendingTasks = assignmentRows
      .filter(
        (assignment) =>
          assignment.target_scope === "all_students" ||
          targetedAssignmentIds.has(assignment.id),
      )
      .filter((assignment) => {
        const submission = latestSubmissionByAssignment.get(assignment.id);
        return !submission || submission.status === "revision_required";
      })
      .map((assignment) => ({
        task_id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        type: assignment.assignment_type,
        course_id: assignment.course_id,
        course_title: assignment.course_id
          ? (courseById.get(assignment.course_id)?.title ?? null)
          : null,
        starts_at: assignment.starts_at,
        due_at: assignment.due_at,
        status:
          latestSubmissionByAssignment.get(assignment.id)?.status ?? "pending",
      }));

    return NextResponse.json({
      student_id: studentId,
      recent_completed_chapters: progressRows.map((progress) => {
        const lesson = lessonById.get(progress.lesson_id);
        const course = courseById.get(progress.course_id);

        return {
          chapter_id: progress.lesson_id,
          chapter_slug: lesson?.slug ?? null,
          chapter_title: lesson?.title ?? null,
          course_id: progress.course_id,
          course_slug: course?.slug ?? null,
          course_title: course?.title ?? null,
          progress_percent: progress.progress_percent,
          completed_at: progress.completed_at,
        };
      }),
      accuracy: {
        percentage:
          totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 10_000) / 100
            : null,
        correct_count: correctCount,
        total_questions: totalQuestions,
        attempt_count: attempts.length,
      },
      pending_tasks: pendingTasks,
    });
  } catch (error) {
    console.error("[agent-actions/student-progress] Unexpected failure", {
      studentId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to query student progress" },
      { status: 500 },
    );
  }
}
