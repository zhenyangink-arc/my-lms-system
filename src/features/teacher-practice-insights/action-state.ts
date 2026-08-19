export type PracticeRecommendationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialPracticeRecommendationActionState: PracticeRecommendationActionState = {
  status: "idle",
  message: "",
};
