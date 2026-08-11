import type { UserRole } from "@/lib/admin";

export type LearningRecordType =
  | "coaching"
  | "evaluation"
  | "milestone"
  | "attention"
  | "plan";

export type LearningRecordStatus = "active" | "archived";
export type LearningRecordVisibility = "student_visible" | "internal";

export type LearningRecordStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
};

export type LearningRecordNote = {
  id: string;
  student_id: string;
  record_type: LearningRecordType;
  title: string;
  content: string;
  next_action: string;
  visibility: LearningRecordVisibility;
  status: LearningRecordStatus;
  occurred_at: string;
  updated_at: string;
};

export type LearningRecordOverviewRpcRow = {
  student_id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
  completed_lesson_count: number | string | null;
  active_lesson_count: number | string | null;
  submission_count: number | string | null;
  graded_submission_count: number | string | null;
  conversation_practice_count: number | string | null;
  grade_count: number | string | null;
  note_count: number | string | null;
  attention_count: number | string | null;
  last_learning_at: string | null;
};

export type LearningRecordOverviewRow = {
  student_id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
  completed_lesson_count: number;
  active_lesson_count: number;
  submission_count: number;
  graded_submission_count: number;
  conversation_practice_count: number;
  grade_count: number;
  note_count: number;
  attention_count: number;
  last_learning_at: string | null;
};

export type PlatformLearningRecordOverviewRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number;
  total_record_count: number;
  active_record_count: number;
  student_visible_count: number;
  internal_record_count: number;
  attention_record_count: number;
  plan_record_count: number;
  last_record_at: string | null;
};

export type PlatformLearningRecordManagementData = {
  scope: "platform";
  role: UserRole;
  canManageNotes: false;
  overview: PlatformLearningRecordOverviewRow[];
  hasError: boolean;
};

export type TenantLearningRecordManagementData = {
  scope: "institution";
  role: UserRole;
  tenantId: string;
  dashboardBasePath: string;
  canManageNotes: true;
  assignedStudentIds: string[] | null;
  students: LearningRecordStudent[];
  notes: LearningRecordNote[];
  overview: LearningRecordOverviewRow[];
  hasOverviewError: boolean;
  hasStudentError: boolean;
  hasNoteError: boolean;
};

export type LearningRecordManagementData =
  | PlatformLearningRecordManagementData
  | TenantLearningRecordManagementData;
