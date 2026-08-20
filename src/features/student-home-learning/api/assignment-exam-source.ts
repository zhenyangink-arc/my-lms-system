import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapAssignmentExamTask,
  mapRetakeExamTask,
  type AssignmentExamChapterProgressRow,
  type AssignmentExamProgressRow,
  type AssignmentExamTaskRow,
  type AssignmentExamRetakeSubmissionRow,
} from "./assignment-exam-mapper.ts";
import type { HomeLearningTask } from "./types.ts";

const ASSIGNMENT_COLUMNS = [
  "id",
  "title",
  "description",
  "assignment_type",
  "course_id",
  "starts_at",
  "due_at",
  "allow_late_submission",
  "unlock_after_chapter_completion",
  "unlock_test_slug",
  "due_days_after_unlock",
  "retake_paper_id",
  "retake_starts_at",
  "retake_due_at",
  "updated_at",
].join(",");

type LoadAssignmentExamTasksInput = {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  now?: Date;
};

function throwReadError(label: string, error: { message: string } | null) {
  if (error) {
    throw new Error(`首页作业与考试${label}读取失败`, { cause: error });
  }
}

/**
 * 读取学生首页的作业与正式考试。两条任务查询均在数据库侧限定已发布状态；
 * 指定学生任务还通过 inner target 关系限定 student_id，避免先取回再过滤。
 */
export async function loadAssignmentExamTasks({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now = new Date(),
}: LoadAssignmentExamTasksInput): Promise<HomeLearningTask[]> {
  const [allStudentsResult, selectedStudentsResult] = await Promise.all([
    supabase
      .from("learning_assignments")
      .select(ASSIGNMENT_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("student_app_id", studentAppId)
      .eq("status", "published")
      .eq("target_scope", "all_students")
      .in("assignment_type", ["homework", "exam"]),
    supabase
      .from("learning_assignments")
      .select(
        `${ASSIGNMENT_COLUMNS},learning_assignment_targets!inner(student_id)`,
      )
      .eq("tenant_id", tenantId)
      .eq("student_app_id", studentAppId)
      .eq("status", "published")
      .eq("target_scope", "selected_students")
      .eq("learning_assignment_targets.student_id", studentId)
      .in("assignment_type", ["homework", "exam"]),
  ]);
  throwReadError("全体学生任务", allStudentsResult.error);
  throwReadError("指定学生任务", selectedStudentsResult.error);

  const assignmentById = new Map<string, AssignmentExamTaskRow>();
  for (const row of [
    ...(allStudentsResult.data ?? []),
    ...(selectedStudentsResult.data ?? []),
  ]) {
    const assignment = row as unknown as AssignmentExamTaskRow;
    assignmentById.set(assignment.id, assignment);
  }
  const assignments = [...assignmentById.values()];
  if (assignments.length === 0) return [];

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const unlockTestSlugs = [
    ...new Set(
      assignments
        .filter((assignment) => assignment.unlock_after_chapter_completion)
        .map((assignment) => assignment.unlock_test_slug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ];
  const [progressResult, chapterProgressResult, retakeStudentResult] = await Promise.all([
    supabase
      .from("learning_assignment_progress")
      .select("assignment_id,progress_state,updated_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .in("assignment_id", assignmentIds),
    unlockTestSlugs.length > 0
      ? supabase
          .from("course_ebook_progress")
          .select("test_slug,completed_at")
          .eq("tenant_id", tenantId)
          .eq("student_id", studentId)
          .eq("student_app_id", studentAppId)
          .in("test_slug", unlockTestSlugs)
          .not("completed_at", "is", null)
      : Promise.resolve({
          data: [] as AssignmentExamChapterProgressRow[],
          error: null,
        }),
    supabase
      .from("learning_assignment_retake_students")
      .select("assignment_id,assigned_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .in("assignment_id", assignmentIds),
  ]);
  throwReadError("进度", progressResult.error);
  throwReadError("章节开放状态", chapterProgressResult.error);
  throwReadError("补考名单", retakeStudentResult.error);

  const retakeAssignmentIds = (retakeStudentResult.data ?? []).map(
    (row) => row.assignment_id as string,
  );
  const retakeSubmissionResult = retakeAssignmentIds.length > 0
    ? await supabase
        .from("student_learning_submissions")
        .select("assignment_id,submission_state,submitted_at")
        .in("assignment_id", retakeAssignmentIds)
        .order("submitted_at", { ascending: false })
    : { data: [] as AssignmentExamRetakeSubmissionRow[], error: null };
  throwReadError("补考提交状态", retakeSubmissionResult.error);

  const progressByAssignment = new Map(
    ((progressResult.data ?? []) as AssignmentExamProgressRow[]).map((progress) => [
      progress.assignment_id,
      progress,
    ]),
  );
  const chapterProgressBySlug = new Map(
    ((chapterProgressResult.data ?? []) as AssignmentExamChapterProgressRow[]).map(
      (progress) => [progress.test_slug, progress],
    ),
  );
  const retakeAssignmentIdSet = new Set(retakeAssignmentIds);
  const retakeSubmissionByAssignment = new Map<string, AssignmentExamRetakeSubmissionRow>();
  for (const submission of (retakeSubmissionResult.data ?? []) as AssignmentExamRetakeSubmissionRow[]) {
    const assignment = assignmentById.get(submission.assignment_id);
    if (
      !assignment?.retake_starts_at ||
      new Date(submission.submitted_at) < new Date(assignment.retake_starts_at) ||
      retakeSubmissionByAssignment.has(submission.assignment_id)
    ) continue;
    retakeSubmissionByAssignment.set(submission.assignment_id, submission);
  }

  return assignments.flatMap((assignment) => {
    const originalTask = mapAssignmentExamTask({
      assignment,
      progress: progressByAssignment.get(assignment.id),
      chapterProgress: assignment.unlock_test_slug
        ? chapterProgressBySlug.get(assignment.unlock_test_slug)
        : undefined,
      studentAppId,
      appSlug,
      appLabel,
      space,
      now,
    });
    if (!retakeAssignmentIdSet.has(assignment.id)) return [originalTask];
    const retakeTask = mapRetakeExamTask({
      assignment,
      submission: retakeSubmissionByAssignment.get(assignment.id),
      studentAppId,
      appSlug,
      appLabel,
      space,
      now,
    });
    return retakeTask ? [originalTask, retakeTask] : [originalTask];
  });
}
