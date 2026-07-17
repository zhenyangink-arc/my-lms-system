export type GradeCenterActionState = { status: "idle" | "success" | "error"; message: string };
export const initialGradeCenterActionState: GradeCenterActionState = { status: "idle", message: "" };
