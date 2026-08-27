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
    targetsResult,
    submissionsResult,
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
    admin
      .from("chapter_test_attempts")
      .select("correct_count,total_questions")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId),
    admin
      .from("learning_assignments")
      .select("id,title,due_at,target_scope")
      .eq("tenant_id", tenantId)
      .eq("status", "published")
      .order("due_at", { ascending: true })
      .limit(50),
    admin
      .from("learning_assignment_targets")
      .select("assignment_id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId),
    admin
      .from("learning_submissions")
      .select("assignment_id,status,attempt_number")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("attempt_number", { ascending: false }),
  ]);

  const failed = [
    smartProgressResult,
    lessonProgressResult,
    attemptsResult,
    assignmentsResult,
    targetsResult,
    submissionsResult,
  ].find((result) => result.error);
  if (failed?.error) {
    console.error("[guide-agent] Failed to load student context", {
      code: failed.error.code,
      message: failed.error.message,
    });
    throw new Error("无法读取当前学习进度。");
  }

  const lessonRows = (lessonProgressResult.data ?? []) as LessonProgressRow[];
  const lessonIds = lessonRows.map((row) => row.lesson_id);
  const courseIds = Array.from(new Set(lessonRows.map((row) => row.course_id)));
  const [lessonsResult, coursesResult] = await Promise.all([
    lessonIds.length
      ? admin.from("lessons").select("id,title,slug").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? admin.from("courses").select("id,title,slug").in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
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
