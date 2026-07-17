export type ConversationPracticeActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialConversationPracticeActionState: ConversationPracticeActionState = {
  status: "idle",
  message: "",
};
