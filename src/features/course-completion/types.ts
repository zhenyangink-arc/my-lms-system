export type CompletionRequirementGap = {
  key: string;
  category:
    | "course"
    | "assignment"
    | "chapter_exam"
    | "stage_exam"
    | "midterm_exam"
    | "final_exam"
    | "manual_grading"
    | "overall_score"
    | "chapter_practice"
    | "specialized_practice"
    | "review";
  title: string;
  status: "missing" | "in_progress" | "failed" | "pending_grading";
  currentValue?: number;
  requiredValue?: number;
  sourceId?: string;
  href?: string;
  reason: string;
};

export type CourseCompletionEvaluationStatus =
  | "not_ready"
  | "pending_grading"
  | "not_eligible"
  | "eligible"
  | "superseded";

export type StudentCourseCompletionEvaluation = {
  id: string;
  tenant_id: string;
  student_id: string;
  student_app_id: string;
  course_id: string;
  policy_id: string;
  policy_version: number;
  status: CourseCompletionEvaluationStatus;
  eligible: boolean;
  overall_score: number | null;
  requirements_snapshot: Record<string, unknown>;
  evidence_snapshot: Record<string, unknown>;
  missing_requirements: CompletionRequirementGap[];
  evaluated_at: string;
  evaluation_version: string;
  evaluation_fingerprint: string;
  created_at: string;
  updated_at: string;
};

export type CourseCompletionCertificateStatus =
  | "issued"
  | "revoked"
  | "reissued";

export type CourseCompletionCertificate = {
  id: string;
  tenant_id: string;
  student_id: string;
  student_app_id: string;
  course_id: string;
  evaluation_id: string;
  certificate_number: string;
  status: CourseCompletionCertificateStatus;
  student_name_snapshot: string;
  course_title_snapshot: string;
  policy_snapshot: Record<string, unknown>;
  evidence_snapshot: Record<string, unknown>;
  overall_score_snapshot: number | null;
  issued_by: string;
  issued_at: string;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  reissued_from_id: string | null;
  created_at: string;
};
