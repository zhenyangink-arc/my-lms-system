export type VisaAdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialVisaAdminActionState: VisaAdminActionState = {
  status: "idle",
  message: "",
};
