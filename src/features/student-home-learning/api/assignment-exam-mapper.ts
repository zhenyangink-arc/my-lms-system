import { compareDefaultPriority, createHomeLearningTaskKey } from "../priority.ts";
import { getAssignmentDetailPath, getExamDetailPath } from "../routes.ts";
import { mapAssignmentStatus, mapExamStatus } from "../status.ts";
import type {
  HomeLearningTask,
  HomeLearningTaskPriority,
  HomeLearningTaskStatus,
} from "./types.ts";

export type AssignmentExamProgressState =
  | "in_progress"
  | "submitted_pending_grading"
  | "objective_graded_pending_manual"
  | "grading_completed"
  | "grade_released"
  | "revision_required";

export type AssignmentExamTaskRow = {
  id: string;
  title: string;
  description: string;
  assignment_type: "homework" | "exam";
  course_id: string | null;
  starts_at: string;
  due_at: string;
  allow_late_submission: boolean;
  unlock_after_chapter_completion: boolean;
  unlock_test_slug: string | null;
  due_days_after_unlock: number | null;
  updated_at: string;
};

export type AssignmentExamProgressRow = {
  assignment_id: string;
  progress_state: AssignmentExamProgressState;
  updated_at: string;
};

export type AssignmentExamChapterProgressRow = {
  test_slug: string;
  completed_at: string | null;
};

type MapAssignmentExamTaskInput = {
  assignment: AssignmentExamTaskRow;
  progress?: AssignmentExamProgressRow;
  chapterProgress?: AssignmentExamChapterProgressRow;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  now: Date;
};

const DAY_MS = 86_400_000;

function submissionState(progressState?: AssignmentExamProgressState) {
  if (
    progressState === "submitted_pending_grading" ||
    progressState === "objective_graded_pending_manual"
  ) {
    return "pending_grading" as const;
  }
  if (progressState === "grading_completed" || progressState === "grade_released") {
    return "completed" as const;
  }
  return "none" as const;
}

function statusReason({
  status,
  chapterLocked,
  revisionRequired,
  allowLateSubmission,
}: {
  status: HomeLearningTaskStatus;
  chapterLocked: boolean;
  revisionRequired: boolean;
  allowLateSubmission: boolean;
}): string {
  if (status === "locked" && chapterLocked) return "完成对应章节学习后开放";
  if (status === "in_progress" && revisionRequired) {
    return "老师已退回修改，可继续完成";
  }
  switch (status) {
    case "locked":
      return "尚未到开始时间";
    case "available":
      return "可以开始";
    case "in_progress":
      return "已有草稿，可继续完成";
    case "pending_grading":
      return "已提交，等待批改";
    case "completed":
      return "已完成";
    case "overdue":
      return allowLateSubmission ? "已逾期，仍可提交" : "已逾期，不可提交";
    default:
      return "查看任务详情";
  }
}

function taskPriority({
  sourceType,
  status,
  startsAt,
  dueAt,
  allowLateSubmission,
  now,
}: {
  sourceType: "assignment" | "exam";
  status: HomeLearningTaskStatus;
  startsAt: string;
  dueAt: string;
  allowLateSubmission: boolean;
  now: Date;
}): HomeLearningTaskPriority {
  if (status === "completed" || status === "pending_grading") return "low";

  const nowTime = now.getTime();
  const dueDifference = new Date(dueAt).getTime() - nowTime;
  const startDifference = new Date(startsAt).getTime() - nowTime;
  const rules: Array<Parameters<typeof compareDefaultPriority>[0]> = [
    "continue_learning",
  ];

  if (status === "overdue" && allowLateSubmission) {
    rules.push("overdue_required_completable");
  }
  if (dueDifference >= 0 && dueDifference <= DAY_MS) rules.push("due_today");
  if (
    sourceType === "exam" &&
    ((startDifference >= 0 && startDifference <= DAY_MS) ||
      (dueDifference >= 0 && dueDifference <= DAY_MS))
  ) {
    rules.push("exam_within_24_hours");
  }
  if (dueDifference > DAY_MS && dueDifference <= 2 * DAY_MS) {
    rules.push("due_tomorrow");
  }
  if (dueDifference > 2 * DAY_MS && dueDifference <= 7 * DAY_MS) {
    rules.push("due_this_week");
  }

  const firstRule = rules.sort(compareDefaultPriority)[0];
  if (firstRule === "overdue_required_completable") return "critical";
  if (firstRule === "due_today" || firstRule === "exam_within_24_hours") {
    return "high";
  }
  if (firstRule === "due_tomorrow" || firstRule === "due_this_week") {
    return "normal";
  }
  return "low";
}

export function mapAssignmentExamTask({
  assignment,
  progress,
  chapterProgress,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now,
}: MapAssignmentExamTaskInput): HomeLearningTask {
  const sourceType = assignment.assignment_type === "exam" ? "exam" : "assignment";
  const chapterLocked =
    assignment.unlock_after_chapter_completion && !chapterProgress?.completed_at;
  const effectiveDueAt =
    assignment.unlock_after_chapter_completion &&
    chapterProgress?.completed_at &&
    assignment.due_days_after_unlock
      ? new Date(
          new Date(chapterProgress.completed_at).getTime() +
            assignment.due_days_after_unlock * DAY_MS,
        ).toISOString()
      : assignment.due_at;
  const hasReachedStartTime =
    !chapterLocked && new Date(assignment.starts_at).getTime() <= now.getTime();
  const isPastDue = new Date(effectiveDueAt).getTime() < now.getTime();
  const revisionRequired = progress?.progress_state === "revision_required";
  const hasDraft =
    progress?.progress_state === "in_progress" || revisionRequired;
  const statusInput = {
    publicationStatus: "published" as const,
    hasReachedStartTime,
    isPastDue,
    hasDraft,
    submissionState: submissionState(progress?.progress_state),
  };
  const status =
    sourceType === "exam"
      ? mapExamStatus(statusInput)
      : mapAssignmentStatus(statusInput);

  return {
    taskKey: createHomeLearningTaskKey(studentAppId, sourceType, assignment.id),
    studentAppId,
    appSlug,
    appLabel,
    sourceType,
    sourceId: assignment.id,
    title: assignment.title,
    description: assignment.description || null,
    status,
    priority: taskPriority({
      sourceType,
      status,
      startsAt: assignment.starts_at,
      dueAt: effectiveDueAt,
      allowLateSubmission: assignment.allow_late_submission,
      now,
    }),
    required: true,
    startsAt: assignment.starts_at,
    dueAt: effectiveDueAt,
    progressPercent: status === "completed" ? 100 : null,
    reason: statusReason({
      status,
      chapterLocked,
      revisionRequired,
      allowLateSubmission: assignment.allow_late_submission,
    }),
    href:
      sourceType === "exam"
        ? getExamDetailPath(space, assignment.id)
        : getAssignmentDetailPath(space, assignment.id),
    courseId: assignment.course_id,
    courseChapterId: null,
    skill: null,
    updatedAt: progress?.updated_at ?? assignment.updated_at,
  };
}
