export const HOME_LEARNING_SOURCE_TYPES = [
  "assignment",
  "exam",
  "course",
  "chapter_practice",
  "specialized_practice",
  "review",
  "teacher_recommendation",
  "student_plan",
] as const;

export type HomeLearningTaskSourceType =
  (typeof HOME_LEARNING_SOURCE_TYPES)[number];

export const HOME_LEARNING_TASK_STATUSES = [
  "not_started",
  "available",
  "in_progress",
  "submitted",
  "pending_grading",
  "completed",
  "overdue",
  "locked",
  "unavailable",
] as const;

export type HomeLearningTaskStatus =
  (typeof HOME_LEARNING_TASK_STATUSES)[number];

export const HOME_LEARNING_TASK_PRIORITIES = [
  "critical",
  "high",
  "normal",
  "low",
] as const;

export type HomeLearningTaskPriority =
  (typeof HOME_LEARNING_TASK_PRIORITIES)[number];

export type HomeLearningTask = {
  taskKey: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  sourceType: HomeLearningTaskSourceType;
  sourceId: string;
  title: string;
  description: string | null;
  status: HomeLearningTaskStatus;
  priority: HomeLearningTaskPriority;
  required: boolean;
  startsAt: string | null;
  dueAt: string | null;
  progressPercent: number | null;
  reason: string;
  href: string;
  courseId: string | null;
  courseChapterId: string | null;
  skill: string | null;
  updatedAt: string;
};
