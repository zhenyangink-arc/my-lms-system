import type {
  VisaTaskStage,
  VisaTaskStatus,
} from "../../api/types";

export type VisaTaskDisplayRow = {
  id: string;
  studentName: string;
  universityName: string;
  title: string;
  stage: VisaTaskStage;
  status: VisaTaskStatus;
  studentNote: string;
  adminNote: string;
  submittedAt: string | null;
  updatedAt: string;
};
