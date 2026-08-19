import type { HomeLearningTaskSourceType } from "./api/types";

export function createHomeLearningTaskKey(
  studentAppId: string,
  sourceType: HomeLearningTaskSourceType,
  sourceId: string,
): string {
  return `${studentAppId}:${sourceType}:${sourceId}`;
}

export const DEFAULT_PRIORITY_ORDER = [
  "overdue_required_completable",
  "due_today",
  "exam_within_24_hours",
  "teacher_required_recommendation",
  "due_tomorrow",
  "in_progress_course_or_chapter_practice",
  "due_this_week",
  "review",
  "weak_skill_specialized_practice",
  "continue_learning",
] as const;

export type DefaultPriorityRule = (typeof DEFAULT_PRIORITY_ORDER)[number];

const DEFAULT_PRIORITY_RANK = new Map<DefaultPriorityRule, number>(
  DEFAULT_PRIORITY_ORDER.map((rule, index) => [rule, index]),
);

export function compareDefaultPriority(
  left: DefaultPriorityRule,
  right: DefaultPriorityRule,
): number {
  return DEFAULT_PRIORITY_RANK.get(left)! - DEFAULT_PRIORITY_RANK.get(right)!;
}
