export type LearningAssignmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  submissionState?: string;
  submittedAt?: string;
  attemptNumber?: number;
};

export const initialLearningAssignmentActionState: LearningAssignmentActionState = {
  status: "idle",
  message: "",
};
