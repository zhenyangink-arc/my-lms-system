export type LearningRecordActionState = { status: "idle" | "success" | "error"; message: string };
export const initialLearningRecordActionState: LearningRecordActionState = { status: "idle", message: "" };
