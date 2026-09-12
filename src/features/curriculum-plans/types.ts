export type CurriculumPlanTemplateStatus = "draft" | "published" | "retired";
export type InstitutionCurriculumPlanStatus =
  | "draft"
  | "published"
  | "active"
  | "completed"
  | "cancelled";

export type CurriculumPlanActivityType =
  | "chapter_practice"
  | "course"
  | "listening"
  | "speaking"
  | "reading"
  | "writing"
  | "vocabulary"
  | "grammar"
  | "chapter_test"
  | "stage_exam"
  | "final_exam"
  | "review";

export type CurriculumPlanTemplate = {
  id: string;
  studentAppId: string;
  courseId: string | null;
  title: string;
  description: string | null;
  durationDays: number;
  version: number;
  status: CurriculumPlanTemplateStatus;
  publishedAt: string | null;
  updatedAt: string;
};

export type CurriculumPlanTemplateItem = {
  id: string;
  templateId: string;
  dayOffset: number;
  startMinute: number;
  durationMinutes: number;
  activityType: CurriculumPlanActivityType;
  sourceType: string;
  sourceId: string | null;
  title: string;
  destinationPath: string | null;
  instructions: string | null;
  isRequired: boolean;
  sortOrder: number;
};

export type InstitutionCurriculumPlanProgress = {
  trackedStudentCount: number;
  startedStudentCount: number;
  completedCount: number;
  overdueCount: number;
  pendingGradingCount: number;
  unavailableCount: number;
  totalCount: number;
};

export type InstitutionCurriculumPlan = {
  id: string;
  templateId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: InstitutionCurriculumPlanStatus;
  publishedAt: string | null;
  studentIds: string[];
  progress: InstitutionCurriculumPlanProgress | null;
  execution: Array<{
    studentId: string; itemId: string; title: string; required: boolean; sourceType: string;
    assignmentId: string | null; status: import("../student-home-learning/api/types").HomeLearningTaskStatus;
    progressPercent: number | null; reason: string; startsAt: string; dueAt: string;
  }>;
};

export type CurriculumPlanStudent = {
  id: string;
  name: string;
  loginId: string | null;
};

