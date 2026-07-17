export type LearningAssignmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialLearningAssignmentActionState: LearningAssignmentActionState = {
  status: "idle",
  message: "",
};
