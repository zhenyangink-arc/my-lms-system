export type HelpCenterActionState = { status: "idle" | "success" | "error"; message: string };
export const initialHelpCenterActionState: HelpCenterActionState = { status: "idle", message: "" };
