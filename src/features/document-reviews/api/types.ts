import type { UserRole } from "@/lib/admin";

export type DocumentReviewStatus =
  | "preparing"
  | "pending_review"
  | "revision_required"
  | "approved";

export type DocumentChecklistStatus =
  | "preparing"
  | "completed"
  | "not_needed";

export type DocumentCategory =
  | "identity"
  | "academic"
  | "application"
  | "financial"
  | "language"
  | "other";

export type DocumentReviewTargetRow = {
  id: string;
  user_id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
  application_stage: number;
  document_review_status: DocumentReviewStatus;
  document_review_submitted_at: string | null;
  document_reviewed_at: string | null;
  document_review_note: string | null;
  documents_locked_at: string | null;
  updated_at: string;
};

export type DocumentChecklistRow = {
  id: string;
  target_id: string | null;
  title: string;
  category: DocumentCategory;
  status: DocumentChecklistStatus;
  notes?: string | null;
  admin_note: string | null;
  due_date: string | null;
  updated_at?: string;
  admin_locked_at: string | null;
  sort_order: number;
};

export type DocumentReviewEventRow = {
  id: string;
  target_id: string;
  actor_id: string | null;
  previous_status: DocumentReviewStatus;
  new_status: DocumentReviewStatus;
  note: string;
  created_at: string;
};

export type DocumentReviewProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type DocumentReviewItem = {
  id: string;
  title: string;
  category: DocumentCategory;
  status: DocumentChecklistStatus;
  adminNote: string | null;
  dueDate: string | null;
  lockedAt: string | null;
};

export type DocumentReviewEvent = {
  id: string;
  previousStatus: DocumentReviewStatus;
  newStatus: DocumentReviewStatus;
  note: string;
  actorName: string;
  createdAt: string;
};

export type DocumentReviewApplication = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityName: string;
  programName: string | null;
  admissionTrackLabel: string;
  applicationStage: number;
  reviewStatus: DocumentReviewStatus;
  reviewSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  documentsLockedAt: string | null;
  updatedAt: string;
  documents: DocumentReviewItem[];
  events: DocumentReviewEvent[];
};

export type PlatformDocumentReviewOverviewRpcRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string | null;
  application_count: number | string | null;
  preparing_count: number | string | null;
  pending_review_count: number | string | null;
  revision_required_count: number | string | null;
  approved_count: number | string | null;
  oldest_pending_at: string | null;
  last_activity_at: string | null;
};

export type PlatformDocumentReviewOverviewRow = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: string;
  activeStudentCount: number;
  applicationCount: number;
  preparingCount: number;
  pendingReviewCount: number;
  revisionRequiredCount: number;
  approvedCount: number;
  oldestPendingAt: string | null;
  lastActivityAt: string | null;
};

export type PlatformDocumentReviewManagementData = {
  scope: "platform";
  role: UserRole;
  canReviewApplications: false;
  applications: [];
  overview: PlatformDocumentReviewOverviewRow[];
  hasError: boolean;
};

export type InstitutionDocumentReviewManagementData = {
  scope: "institution";
  role: UserRole;
  tenantId: string;
  dashboardBasePath: string;
  canReviewApplications: boolean;
  applications: DocumentReviewApplication[];
  overview: [];
  hasError: false;
};

export type DocumentReviewManagementData =
  | PlatformDocumentReviewManagementData
  | InstitutionDocumentReviewManagementData;

export type DocumentReviewStudentTarget = Pick<
  DocumentReviewTargetRow,
  | "id"
  | "university_name"
  | "program_name"
  | "admission_track"
  | "documents_locked_at"
  | "application_stage"
  | "document_review_status"
  | "document_review_note"
  | "updated_at"
> & {
  courier_mailed_at: string | null;
  courier_estimated_arrival_at: string | null;
  visa_application_channel: string | null;
};

export type DocumentReviewStudentChecklistItem = DocumentChecklistRow & {
  notes: string | null;
  updated_at: string;
};

export type DocumentReviewStudentDetailData = {
  tenantId: string;
  dashboardBasePath: string;
  student: DocumentReviewProfileRow;
  targets: DocumentReviewStudentTarget[];
  documents: DocumentReviewStudentChecklistItem[];
};
