export type AnnouncementActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAnnouncementActionState: AnnouncementActionState = {
  status: "idle",
  message: "",
};
