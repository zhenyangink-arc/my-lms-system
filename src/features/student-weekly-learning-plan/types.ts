export type StudentWeeklyLearningPlan = {
  id: string;
  studentAppId: string;
  weekStartDate: string;
  targetDays: number;
  targetMinutes: number;
  preferredDays: number[];
  createdAt: string;
  updatedAt: string;
};

export type StudentWeeklyLearningProgress = {
  actualDays: number;
  actualMinutes: number;
  learningSeconds: number;
  daysCompletionPercent: number;
  minutesCompletionPercent: number;
  completionPercent: number;
  goalMet: boolean;
};

export type StudentWeeklyLearningPlanSummary = {
  weekStartDate: string;
  weekEndDate: string;
  plan: StudentWeeklyLearningPlan | null;
  progress: StudentWeeklyLearningProgress | null;
};
