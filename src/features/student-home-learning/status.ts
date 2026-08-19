import type { HomeLearningTaskStatus } from "./api/types";

export type AssessmentSubmissionState =
  | "none"
  | "submitted"
  | "pending_grading"
  | "completed";

export type AssessmentSourceStatusInput = {
  publicationStatus: "draft" | "published" | "closed";
  hasReachedStartTime: boolean;
  isPastDue: boolean;
  hasDraft: boolean;
  submissionState: AssessmentSubmissionState;
};

export type CourseSourceStatusInput = {
  isAvailable: boolean;
  progressStatus: "not_started" | "in_progress" | "completed";
};

export type ChapterPracticeSourceStatusInput = {
  publicationStatus:
    | "not_generated"
    | "draft"
    | "pending_review"
    | "published"
    | "needs_update"
    | "disabled";
  progressStatus:
    | "not_started"
    | "in_progress"
    | "needs_reinforcement"
    | "mastered";
};

export type ReviewSourceStatusInput = {
  isAvailable: boolean;
  reviewStatus: "pending" | "reviewing" | "mastered";
};

function mapAssessmentStatus(
  input: AssessmentSourceStatusInput,
): HomeLearningTaskStatus {
  if (input.submissionState === "completed") return "completed";
  if (input.submissionState === "pending_grading") return "pending_grading";
  if (input.submissionState === "submitted") return "submitted";
  if (
    input.publicationStatus === "draft" ||
    !input.hasReachedStartTime
  ) {
    return "locked";
  }
  if (input.isPastDue) return "overdue";
  if (input.publicationStatus === "closed") return "unavailable";
  return input.hasDraft ? "in_progress" : "available";
}

export function mapAssignmentStatus(
  input: AssessmentSourceStatusInput,
): HomeLearningTaskStatus {
  return mapAssessmentStatus(input);
}

export function mapExamStatus(
  input: AssessmentSourceStatusInput,
): HomeLearningTaskStatus {
  return mapAssessmentStatus(input);
}

export function mapCourseStatus(
  input: CourseSourceStatusInput,
): HomeLearningTaskStatus {
  if (!input.isAvailable) return "locked";
  if (input.progressStatus === "completed") return "completed";
  if (input.progressStatus === "in_progress") return "in_progress";
  return "available";
}

export function mapChapterPracticeStatus(
  input: ChapterPracticeSourceStatusInput,
): HomeLearningTaskStatus {
  if (input.publicationStatus !== "published") return "unavailable";
  if (input.progressStatus === "mastered") return "completed";
  if (
    input.progressStatus === "in_progress" ||
    input.progressStatus === "needs_reinforcement"
  ) {
    return "in_progress";
  }
  return "available";
}

export function mapReviewStatus(
  input: ReviewSourceStatusInput,
): HomeLearningTaskStatus {
  if (!input.isAvailable) return "unavailable";
  if (input.reviewStatus === "mastered") return "completed";
  if (input.reviewStatus === "reviewing") return "in_progress";
  return "available";
}
