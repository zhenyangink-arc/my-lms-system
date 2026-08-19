export type OverviewRate = {
  completed: number;
  total: number;
  rate: number;
};

export type InstitutionClassComparison = {
  classKey: string;
  className: string;
  teacherId: string;
  studentAppId: string;
  studentCount: number;
  active: OverviewRate;
  requiredCompletion: OverviewRate;
};

export type InstitutionLearningOverview = {
  tenantId: string;
  tenantName: string;
  studentCount: number;
  active: OverviewRate;
  requiredCompletion: OverviewRate;
  homeworkOnTime: OverviewRate;
  examParticipation: OverviewRate;
  chapterPracticeUsage: OverviewRate;
  reviewUsage: OverviewRate;
  classes: InstitutionClassComparison[];
};

export type InstitutionPlatformOverviewSnapshot = {
  generatedAt: string;
  scope: "institution" | "platform";
  institutions: InstitutionLearningOverview[];
};

export type PlatformLearningRuleDefaults = {
  taskPriorityOrder: readonly string[];
  dueSoonHours: number;
  maxSystemSuggestions: number;
  weakSkillMasteryPercentBelow: number;
  reviewErrorCountAtLeast: number;
  weeklyTargetDays: number;
  weeklyTargetMinutes: number;
};
