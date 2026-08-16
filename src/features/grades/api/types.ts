import type { UserRole } from "@/lib/admin";

export type LiveGradeSourceType =
  | "assignment_submission"
  | "chapter_test_attempt";

export type GradeReviewSourceType =
  | "manual_grade_record"
  | LiveGradeSourceType;

export type GradeReviewStatus =
  | "pending"
  | "reviewing"
  | "resolved"
  | "rejected";

export type AssignmentGradeSource = {
  id: string;
  title: string;
  assignment_type: "homework" | "quiz" | "exam";
  total_points: number;
  course_id: string | null;
  status: "published" | "closed";
};

export type LearningSubmissionGrade = {
  id: string;
  assignment_id: string;
  student_id: string;
  score: number;
  overall_feedback: string | null;
  graded_at: string | null;
  submitted_at: string;
  attempt_number: number;
};

export type ChapterTestGradeSource = {
  id: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
  passing_score: number;
};

export type ChapterTestGradeAttempt = {
  id: string;
  student_id: string;
  test_slug: string;
  score: number;
  correct_count: number;
  total_questions: number;
  passed: boolean;
  attempted_at: string;
};

export type GradeReviewRequest = {
  id: string;
  record_id: string | null;
  student_id: string;
  student_name: string;
  source_type: GradeReviewSourceType;
  source_result_id: string | null;
  source_title: string;
  source_score: number | null;
  source_total_points: number | null;
  source_context: Record<string, unknown> | null;
  reason: string;
  status: GradeReviewStatus;
  response: string;
  requested_at: string;
  linked_result_key: string | null;
};

export type LiveGradeResult = {
  key: string;
  source_type: LiveGradeSourceType;
  source_result_id: string;
  source_id: string;
  student_id: string;
  student_name: string;
  course_name: string;
  title: string;
  type_label: string;
  score: number;
  total_points: number;
  detail: string;
  result_label: string;
  passed: boolean;
  recorded_at: string;
  detail_path: string;
  review_status: GradeReviewStatus | null;
};

export type GradeSourceSummary = {
  source_type: LiveGradeSourceType;
  source_id: string;
  course_name: string;
  title: string;
  type_label: string;
  status: "published" | "closed";
  result_count: number;
};

export type PlatformGradeOverviewRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string;
  published_assignment_count: number | string;
  grade_record_count: number | string;
  average_score_percent: number | string | null;
  pass_rate_percent: number | string | null;
  pending_review_count: number | string;
  last_grade_at: string | null;
};

export type PlatformGradeManagementData = {
  scope: "platform";
  role: UserRole;
  canManageIndividualGrades: false;
  overview: PlatformGradeOverviewRow[];
  hasError: boolean;
};

export type InstitutionGradeManagementData = {
  scope: "institution";
  role: UserRole;
  tenantId: string;
  canManageIndividualGrades: boolean;
  assignedStudentIds: string[] | null;
  results: LiveGradeResult[];
  reviews: GradeReviewRequest[];
  sources: GradeSourceSummary[];
  pendingReviewCount: number;
  hasError: boolean;
};

export type GradeManagementData =
  | PlatformGradeManagementData
  | InstitutionGradeManagementData;
