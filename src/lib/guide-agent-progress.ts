import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type GuideAgentProgressInput = {
  studentId: string;
  tenantId: string;
};

type LessonProgressRow = {
  lesson_id: string;
  course_id: string;
  progress_percent: number;
  completed_at: string | null;
};

type AssignmentRow = {
  id: string;
  title: string;
  due_at: string;
  target_scope: "all_students" | "selected_students";
};

export async function getGuideAgentStudentContext({
  studentId,
  tenantId,
}: GuideAgentProgressInput) {
  const admin = createAdminClient();
  const [
    smartProgressResult,
    lessonProgressResult,
    attemptsResult,
    assignmentsResult,
  ] = await Promise.all([
    admin
      .from("digital_textbook_node_progress")
      .select("status,completion_percent,mastery_score,last_activity_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(100),
    admin
      .from("lesson_progress")
      .select("lesson_id,course_id,progress_percent,completed_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(20),
    // chapter_test_attempts 有 (tenant_id, student_id, test_slug) 唯一约束，每个测试只留一行，
    // 行数天然受限于测试数量，这里的 limit 只是兜底，不影响正确性。
    admin
      .from("chapter_test_attempts")
      .select("correct_count,total_questions")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .limit(200),
    admin
      .from("learning_assignments")
      .select("id,title,due_at,target_scope")
      .eq("tenant_id", tenantId)
      .eq("status", "published")
      .order("due_at", { ascending: true })
      .limit(50),
  ]);

  const firstRoundFailure = [
    smartProgressResult,
    lessonProgressResult,
    attemptsResult,
    assignmentsResult,
  ].find((result) => result.error);
  if (firstRoundFailure?.error) {
    console.error("[guide-agent] Failed to load student context", {
      code: firstRoundFailure.error.code,
      message: firstRoundFailure.error.message,
    });
    throw new Error("无法读取当前学习进度。");
  }

  const lessonRows = (lessonProgressResult.data ?? []) as LessonProgressRow[];
  const lessonIds = lessonRows.map((row) => row.lesson_id);
  const courseIds = Array.from(new Set(lessonRows.map((row) => row.course_id)));
  // learning_assignment_targets / learning_submissions 按学生全量拉取可能不小且没有天然上限，
  // 但我们只关心上面这最多 50 个已发布作业的指派与提交状态，所以直接按 assignment_id 收窄范围——
  // 这样既避免了全表扫描式的无上限查询，又不会像“按行数截断”那样可能漏掉某个作业的最新提交记录。
  const assignmentIds = ((assignmentsResult.data ?? []) as AssignmentRow[]).map((row) => row.id);
  const [lessonsResult, coursesResult, targetsResult, submissionsResult] = await Promise.all([
    lessonIds.length
      ? admin.from("lessons").select("id,title,slug").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? admin.from("courses").select("id,title,slug").in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? admin
          .from("learning_assignment_targets")
          .select("assignment_id")
          .eq("tenant_id", tenantId)
          .eq("student_id", studentId)
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? admin
          .from("learning_submissions")
          .select("assignment_id,status,submitted_at")
          .eq("tenant_id", tenantId)
          .eq("student_id", studentId)
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const secondRoundFailure = [lessonsResult, coursesResult, targetsResult, submissionsResult].find(
    (result) => result.error,
  );
  if (secondRoundFailure?.error) {
    console.error("[guide-agent] Failed to load student context", {
      code: secondRoundFailure.error.code,
      message: secondRoundFailure.error.message,
    });
    throw new Error("无法读取当前学习进度。");
  }

  const lessonById = new Map(
    (lessonsResult.data ?? []).map((row) => [String(row.id), row]),
  );
  const courseById = new Map(
    (coursesResult.data ?? []).map((row) => [String(row.id), row]),
  );

  const smartRows = smartProgressResult.data ?? [];
  const completedSmartNodes = smartRows.filter((row) => row.status === "completed").length;
  const inProgressSmartNodes = smartRows.filter((row) => row.status === "in_progress").length;
  const averageSmartCompletion = smartRows.length
    ? Math.round(
        smartRows.reduce(
          (sum, row) => sum + (Number(row.completion_percent) || 0),
          0,
        ) / smartRows.length,
      )
    : 0;

  const attempts = attemptsResult.data ?? [];
  const correctCount = attempts.reduce(
    (sum, row) => sum + (Number(row.correct_count) || 0),
    0,
  );
  const totalQuestions = attempts.reduce(
    (sum, row) => sum + (Number(row.total_questions) || 0),
    0,
  );
  const targetIds = new Set(
    (targetsResult.data ?? []).map((row) => String(row.assignment_id)),
  );
  const latestSubmissionByAssignment = new Map<string, string>();
  for (const row of submissionsResult.data ?? []) {
    const assignmentId = String(row.assignment_id);
    if (!latestSubmissionByAssignment.has(assignmentId)) {
      latestSubmissionByAssignment.set(assignmentId, String(row.status));
    }
  }
  const pendingAssignments = ((assignmentsResult.data ?? []) as AssignmentRow[])
    .filter(
      (assignment) =>
        assignment.target_scope === "all_students" || targetIds.has(assignment.id),
    )
    .filter((assignment) => {
      const status = latestSubmissionByAssignment.get(assignment.id);
      return !status || status === "revision_required";
    })
    .slice(0, 10)
    .map((assignment) => ({
      title: assignment.title,
      dueAt: assignment.due_at,
      status: latestSubmissionByAssignment.get(assignment.id) ?? "pending",
    }));

  return {
    smartTextbook: {
      trackedNodes: smartRows.length,
      completedNodes: completedSmartNodes,
      inProgressNodes: inProgressSmartNodes,
      averageCompletionPercent: averageSmartCompletion,
      lastActivityAt: smartRows[0]?.last_activity_at ?? null,
    },
    recentLessons: lessonRows.slice(0, 8).map((row) => ({
      course: courseById.get(row.course_id)?.title ?? "未命名课程",
      lesson: lessonById.get(row.lesson_id)?.title ?? "未命名课时",
      progressPercent: row.progress_percent,
      completedAt: row.completed_at,
    })),
    assessment: {
      attemptCount: attempts.length,
      correctCount,
      totalQuestions,
      accuracyPercent: totalQuestions
        ? Math.round((correctCount / totalQuestions) * 10_000) / 100
        : null,
    },
    pendingAssignments,
  };
}
