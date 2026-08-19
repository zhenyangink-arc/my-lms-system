export const TEACHER_CLASS_TASK_STATUSES = [
  "not_started",
  "in_progress",
  "pending_grading",
  "completed",
  "overdue",
  "locked",
] as const;

export type TeacherClassTaskStatus =
  (typeof TEACHER_CLASS_TASK_STATUSES)[number];

export type TeacherClassTodaySummary = {
  studentCount: number;
  studiedTodayCount: number;
  requiredTaskTotal: number;
  requiredTaskCompleted: number;
  requiredCompletionRate: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
  pendingGradingCount: number;
  continuousNoLearningCount: number;
};

export type TeacherClassTodayStudent = {
  studentId: string;
  fullName: string | null;
  loginId: string | null;
  studiedToday: boolean;
  lastActivityAt: string | null;
  inactiveDays: number;
  continuousNoLearning: boolean;
  requiredTaskTotal: number;
  requiredTaskCompleted: number;
  notStartedTaskCount: number;
  inProgressTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  pendingGradingTaskCount: number;
};

export type TeacherClassTodayTask = {
  assignmentId: string;
  title: string;
  assignmentType: "homework" | "exam";
  status: TeacherClassTaskStatus;
  startsAt: string;
  dueAt: string;
  isRequiredToday: boolean;
};

export type TeacherClassTodaySnapshot = {
  generatedAt: string;
  summary: TeacherClassTodaySummary;
  students: TeacherClassTodayStudent[];
  tasks: TeacherClassTodayTask[];
};
