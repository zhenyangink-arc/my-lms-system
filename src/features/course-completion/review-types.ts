import type {
  CompletionRequirementGap,
  CourseCompletionCertificateStatus,
  CourseCompletionEvaluationStatus,
} from "./types";

export type CompletionReviewEvaluation = {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  status: Exclude<CourseCompletionEvaluationStatus, "superseded">;
  overallScore: number | null;
  evaluatedAt: string;
  missingRequirements: CompletionRequirementGap[];
  completedItems: string[];
};

export type CompletionRetakePaper = {
  id: string;
  title: string;
  paperCode: string;
};

export type CompletionReviewCertificate = {
  id: string;
  evaluationId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  certificateNumber: string;
  status: CourseCompletionCertificateStatus;
  overallScore: number | null;
  issuedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  replacementEvaluationId: string | null;
};

export type CompletionReviewData = {
  eligible: CompletionReviewEvaluation[];
  notEligible: CompletionReviewEvaluation[];
  issued: CompletionReviewCertificate[];
  revoked: CompletionReviewCertificate[];
  retakePapers: CompletionRetakePaper[];
  retakePaperIdByAssignmentId: Record<string, string>;
};

export type CompletionCertificateActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialCompletionCertificateActionState: CompletionCertificateActionState = {
  status: "idle",
  message: "",
};
