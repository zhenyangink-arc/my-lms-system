import type { UserRole } from "@/lib/admin";

export type VisaType =
  | "d4_language"
  | "d2_bachelor"
  | "d2_master"
  | "d2_doctor";

export type VisaApplicationChannel =
  | "china_consulate"
  | "korea_immigration";

export type VisaCaseStatus =
  | "admin_preparing"
  | "planning"
  | "preparing"
  | "ready_to_submit"
  | "submitted"
  | "additional_documents"
  | "approved"
  | "issued"
  | "closed";

export type VisaTaskStage =
  | "admission"
  | "identity"
  | "finance"
  | "application"
  | "appointment"
  | "submission"
  | "result"
  | "entry";

export type VisaTaskStatus =
  | "pending"
  | "in_progress"
  | "submitted"
  | "reviewing"
  | "approved"
  | "revision_required"
  | "blocked";

export type VisaCaseRow = {
  id: string;
  user_id: string;
  source_target_id: string | null;
  visa_type: VisaType;
  application_channel: VisaApplicationChannel;
  case_status: VisaCaseStatus;
  target_entry_date: string | null;
  planned_entry_date: string | null;
  application_city: string | null;
  advisor_note: string | null;
  updated_at: string;
};

export type VisaTaskRow = {
  id: string;
  user_id: string;
  title: string;
  stage: VisaTaskStage;
  status: VisaTaskStatus;
  student_note: string | null;
  admin_note: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export type VisaTargetRow = {
  id: string;
  user_id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
};

export type VisaProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type VisaTaskSummary = {
  id: string;
  title: string;
  stage: VisaTaskStage;
  status: VisaTaskStatus;
  studentNote: string;
  adminNote: string;
  submittedAt: string | null;
  updatedAt: string;
};

export type VisaManagementCase = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityName: string;
  programName: string;
  admissionTrack: string;
  visaType: VisaType;
  applicationChannel: VisaApplicationChannel;
  caseStatus: VisaCaseStatus;
  targetEntryDate: string | null;
  plannedEntryDate: string | null;
  applicationCity: string | null;
  advisorNote: string | null;
  updatedAt: string;
  tasks: VisaTaskSummary[];
};

export type PlatformVisaOverviewRpcRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string | null;
  case_count: number | string | null;
  admin_preparing_count: number | string | null;
  preparing_count: number | string | null;
  submitted_count: number | string | null;
  additional_documents_count: number | string | null;
  approved_count: number | string | null;
  issued_count: number | string | null;
  pending_task_count: number | string | null;
  support_task_count: number | string | null;
  upcoming_entry_count: number | string | null;
  oldest_pending_at: string | null;
  last_activity_at: string | null;
};

export type PlatformVisaOverviewRow = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: string;
  activeStudentCount: number;
  caseCount: number;
  adminPreparingCount: number;
  preparingCount: number;
  submittedCount: number;
  additionalDocumentsCount: number;
  approvedCount: number;
  issuedCount: number;
  pendingTaskCount: number;
  supportTaskCount: number;
  upcomingEntryCount: number;
  oldestPendingAt: string | null;
  lastActivityAt: string | null;
};

export type PlatformVisaCaseAuditRpcRow = {
  tenant_id: string;
  case_reference: string;
  visa_type: VisaType;
  application_channel: VisaApplicationChannel;
  case_status: VisaCaseStatus;
  task_count: number | string | null;
  approved_task_count: number | string | null;
  pending_task_count: number | string | null;
  support_task_count: number | string | null;
  target_entry_date: string | null;
  planned_entry_date: string | null;
  oldest_pending_at: string | null;
  updated_at: string;
};

export type PlatformVisaCaseAuditRow = {
  tenantId: string;
  caseReference: string;
  visaType: VisaType;
  applicationChannel: VisaApplicationChannel;
  caseStatus: VisaCaseStatus;
  taskCount: number;
  approvedTaskCount: number;
  pendingTaskCount: number;
  supportTaskCount: number;
  targetEntryDate: string | null;
  plannedEntryDate: string | null;
  oldestPendingAt: string | null;
  updatedAt: string;
};

export type PlatformVisaManagementData = {
  scope: "platform";
  role: UserRole;
  canManageIndividualCases: false;
  cases: [];
  overview: PlatformVisaOverviewRow[];
  caseAudit: PlatformVisaCaseAuditRow[];
  hasError: boolean;
};

export type InstitutionVisaManagementData = {
  scope: "institution";
  role: UserRole;
  tenantId: string;
  canManageIndividualCases: true;
  cases: VisaManagementCase[];
  overview: [];
  caseAudit: [];
  hasError: false;
};

export type VisaManagementData =
  | PlatformVisaManagementData
  | InstitutionVisaManagementData;

export type VisaCaseDetailRow = VisaCaseRow & {
  residence_province: string | null;
  residence_city: string | null;
  accommodation_status: string | null;
  airport_pickup_required: boolean | null;
  departure_province: string | null;
  departure_airport: string | null;
  arrival_region: string | null;
  arrival_airport: string | null;
  advisor_note: string | null;
};

export type VisaTaskDetailRow = VisaTaskRow & {
  description: string | null;
  submission_version: number;
  reviewed_at: string | null;
  sort_order: number;
};

export type VisaManagementStudentDetailData = {
  tenantId: string;
  student: VisaProfileRow;
  visaCase: VisaCaseDetailRow;
  target: Omit<VisaTargetRow, "user_id">;
  tasks: VisaTaskDetailRow[];
};
