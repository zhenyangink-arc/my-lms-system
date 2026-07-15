export type VisaActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialVisaActionState: VisaActionState = {
  status: "idle",
  message: "",
};
