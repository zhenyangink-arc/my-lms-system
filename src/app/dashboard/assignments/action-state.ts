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

export type AssignmentRemediationState = {
  status: "idle" | "correct" | "incorrect" | "error";
  message: string;
  correctAnswer: string | null;
  explanation: string | null;
};

export const initialAssignmentRemediationState: AssignmentRemediationState = {
  status: "idle",
  message: "",
  correctAnswer: null,
  explanation: null,
};
